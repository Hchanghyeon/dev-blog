import React from "react";
import Layout from "components/Layout";
import SEO from "components/SEO";
import { title, description, siteUrl } from "../../blog-config"


const ResumePage = () => {
    return (
        <Layout>
          <SEO title={title} description={description} url={siteUrl} />
          
        </Layout>
      )
}

export default ResumePage;