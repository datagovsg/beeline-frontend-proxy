# beeline-frontend-proxy

A tiny SEO-friendly Node.js proxy for an Angular/Ionic app

# Background

The [mobile app](https://github.com/datagovsg/beeline-frontend) for Beeline is built using AngularJS and the Ionic Framework.
The app recently had [`html5mode`](https://docs.angularjs.org/guide/$location#html5-mode) enabled, so that links from our application can take on the form:
```
https://app.beeline.sg/tabs/routes
```
instead of:
```
https://app.beeline.sg/#/tabs/routes
```
The former is friendlier to search engine crawlers, which cannot read hyperlink anchors, ie, anything past the `#`.

However, for this to completely work, we need to ensure that such links return content when visited directly. We also might want to identify crawlers and agents that generate social media post previews, and serve static content for them.

# What this does

A very short Node.js application was written to address this need. It assumes that any URL request that does not contain a `.` must be a deep link into the app, and so we ignore the path and serve the index content, where the app is hosted.

If we encounter a crawler asking for a specific URL, we will rewrite it and serve static content containing [Open Graph](https://ogp.me/) tags from an alternate location. 

# Why not nginx?

Our traffic is fairly manageable thus far, and most of our static content is cached by CloudFlare. Given that our environment is largely built on Heroku, and our light capacity requirements, it made more sense to focus on ease of maintenance and rapid deployment, and let Heroku handle ancillary matters (such as configuring SSL certificates for HTTPS, and monitoring). 

We might consider moving to Amazon API Gateway with AWS Lambda if the volumes justify them.

# Contributing
We welcome contributions to code open sourced by the Government Technology Agency of Singapore. All contributors will be asked to sign a Contributor License Agreement (CLA) in order to ensure that everybody is free to use their contributions.
