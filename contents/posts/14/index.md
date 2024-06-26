---
title: "[OMG-7] 일일 캐릭터 조회 랭킹 구현하기"
description: "하루동안 사용자들이 조회한 캐릭터 랭킹 구현하기"
date: 2024-03-15
update: 2024-03-15
tags:
  - OMG
  - 개발일지
  - 서비스
  - 게임
  - 모바일
  - 랭킹
  - 백엔드
series: "취업도 못해본 개발자의 우당탕탕 실서비스 개발 및 운영 이야기"
---

저번 글까지는 클라이언트가 게임을 선택하고 그 게임에 맞는 Input 값을 입력하면 캐릭터가 조회되며 캐릭터에 대한 상세 정보를 보여주는 기능을 만들었었습니다. 이번에는 사용자들에게 조금 더 재미 요소를 추가하고자 하루동안 검색된 캐릭터들의 횟수를 구하여 메인페이지 조회시 랭킹을 보여주려고 합니다.

### 랭킹 기능 아키텍처 

현재까지 구현된 캐릭터 조회 기능만 생각해보면, 데이터베이스 없이 게임사 서버로 부터 받은 데이터를 정리하여 클라이언트에게 보내주기만 하면 됩니다. 하지만 새로 추가될 캐릭터들의 조회 횟수 랭킹을 구현하려면 사용자들이 조회한 캐릭터에 대한 정보를 데이터베이스에 기록해두어야합니다.

#### 변경 전 아키텍처
![서비스 아키텍처](image.png)

#### 변경 후 아키텍처
![서비스 아키텍처](image-1.png)

그러기 위해 RDS를 추가하고, 캐릭터에 대한 조회 정보를 데이터베이스에 기록하기로 결정했습니다. 

### dev 환경 MySQL 구축하기
현재는 운영 환경 서버가 구축된 것이 아니기 때문에 개인 NAS 서버에 있는 Docker를 활용하여 MySQL 서버를 구축했습니다. 

#### 레지스트리에서 MySQL 선택
![alt text](image-2.png)
NAS의 Container Manager에 들어가서 레지스트리 탭을 선택 후 MySQL을 선택하여 클릭합니다.

#### 이미지 실행
![alt text](image-3.png) <br>
이미지 탭에 들어가서 MySQL을 실행시킵니다.

#### 이미지 설정
![alt text](image-4.png) <br>
MySQL 버전과 컨테이너 이름을 설정해줍니다. <br>

![alt text](image-5.png) <br>
다음을 클릭하여 포트를 지정해줍니다. 이때 왼쪽은 컨테이너 밖의 외부 포트이고, 오른쪽은 컨테이너안에서 쓰이는 내부포트입니다. MySQL의 포트는 기본적으로 3306 이기 때문에 별도로 설정하지 않는 경우 오른쪽 내부 포트는 그대로 두면되고, 외부에서 접속하는 포트를 변경하고 싶을 땐 왼쪽은 다르게 포트를 주면 됩니다. <br>

![alt text](image-6.png) <br>
마지막으로 컨테이너 안에서 실행될 환경변수를 설정해주어야합니다. 위 사진처럼 총 4개의 환경변수를 세팅하여, 실행시 해당하는 정보로 설정되어 실행될 수 있도록 합니다.

#### 컨테이너 실행
마지막으로 컨테이너 실행을 시키면, 정상적으로 컨테이너가 올라오게되고 외부에서 접속하기 위해 공유기에서도 포트포워딩을 해주어야합니다. 저의 경우 이미 해당 NAS 서버가 DMZ 설정이 되어있어서 건너뛰도록 하겠습니다.

### 랭킹 기능 테이블 설계
우선 랭킹을 위해 저장해야하는 정보는 `게임명`,`월드명`,`캐릭터명`,`생성시각`,`수정시각` 총 5가지입니다. 카운트 컬럼을 따로 두어 해당 캐릭터가 몇번이나 조회되었는지 체크해서 랭킹을 산정할까도 고려했지만, 일일 단위로 조회 개수를 판단해야했기 때문에 해당 방식으로는 구현할 수 없었습니다.

```sql
create table game_character_search_log (
    id bigint not null auto_increment,
    game_type varchar(20) not null,
	world_name varchar(50),
    character_name varchar(50) not null,
	created_at datetime(6),
    updated_at datetime(6),
    primary key (id)
) engine=InnoDB
```

위와 같이 테이블을 설계하고, 사용자들은 이제 캐릭터를 조회할 때 마다 위 정보가 자동으로 데이터베이스에 저장되어, 랭킹 산정을 위한 데이터를 쌓을 수 있게됩니다.

### 랭킹 기능 쿼리 작성
```java
public interface GameCharacterSearchLogRepository extends JpaRepository<GameCharacterSearchLog, Long> {

    @Query("""
            SELECT new com.chang.omg.domains.game.domain.GameCharacterSearchRank
            (g.worldName, g.characterName, COUNT(g.characterName))
            FROM GameCharacterSearchLog g 
            WHERE g.createdAt > CURRENT_DATE AND g.gameType =:gameType
            GROUP BY g.characterName, g.worldName 
            ORDER BY COUNT(g.characterName) DESC
            LIMIT 5
            """)
    List<GameCharacterSearchRank> findGameCharacterSearchRank(final GameType gameType);
}
```
이제 랭킹 기능에 대한 쿼리 작성 부분입니다. 복잡한 쿼리 작성을 위해 @Query 어노테이션을 이용했고, 별도의 DTO를 받기 위해 new를 이용하여 새로운 객체를 생성해서 담게되었습니다. 

쿼리는 특정 게임 유형에 해당하면서, 생성 날짜가 현재 날짜보다 늦은(즉, 오늘 생성된) 게임 캐릭터의 로그를 조회하여, 가장 많이 검색된 상위 5개의 캐릭터에 대한 정보를 불러오는 쿼리입니다.

### 쿼리 적용 후 실제 적용 화면
![alt text](image-7.png) <br>
클라이언트에서 위와 같이 조회된 캐릭터에 대한 일일 랭킹을 볼 수 있게되었습니다.

### 개선해야할 점 
지금까지 일일 랭킹을 만들기 위해 쿼리문을 이용하여 사용자들이 해당 페이지를 요청할 때마다 DB에서 데이터를 불러오도록 구현했습니다. 하지만 정말로 많은 사용자들이 해당 페이지를 요청할 때는 이러한 구조는 좋지 못합니다. 매번 데이터베이스로 쿼리가 나간다는 것은 성능상 좋지 못할 수 있는데요. 이러한 부분을 Redis의 Sorted Set을 활용하여 처리하거나, 비즈니스 로직을 변경하여 하루 단위로 일일 랭킹을 보여주거나 하는 방식으로 처리해볼 수 있을 것 같습니다. 나중에 이 부분에 대해서도 다뤄보도록 하겠습니다.




