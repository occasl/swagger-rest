# swagger-rest

REST client illustrating the use of [Restify](http://restify.com) and other tools to connect to [petstore swagger](http://petstore.swagger.io). This will exercise egress from Docker deployments that are deployed locally to Docker Machine as well as to Apecera or AWS ECS.

[Swagger](http://swagger.io) is a simple yet powerful representation of your RESTful API. With the largest ecosystem of API tooling on the planet, thousands of developers are supporting Swagger in almost every modern programming language and deployment environment. With a Swagger-enabled API, you get interactive documentation, client SDK generation and discoverability.

## Installation and Run Locally

1. Install the necessary dependencies

    ```
    $ npm install
    ```

2. Build the code with [grunt](http://gruntjs.com) which will output to `dist` directory

    ```
    $ grunt
    ```

3. Run the code

    ```
    $ cd dist
    $ node server.js
    ```
    
4. Test the code with [mocha](http://mochajs.org) or use the API described below with your own REST client. Be sure to set the Authorization header for BASIC authn as shown in `test\swagger-test.js`

    ```
    $ mocha
    ```

## API

Here are the APIs available:

| URI | Description |
|-----|-------------|
|GET /pet?sort=[id or name]|Use this to search for all pets and sort by either providing *name* or *id* as a parameter. Omitting sort parameter will result in sort by ID.|
|GET /pet/findByStatus/[available, pending, sold]|Will return all pets by the status provided. You can use any combination or none at all (default will be available).|
|POST /pet/ | POSTs JSON body (see example below) to petstore.swagger.io|
|DELETE /pet/:id| Delete Pet based on unique ID provided|

Sample JSON with possible values/types. Note that only name and photoUrls are required.

```javascript
{
  "category": {
    "id": 0,
    "name": "string"
  },
  "name": "doggie",
  "photoUrls": [
    "string"
  ],
  "tags": [
    {
      "id": 0,
      "name": "string"
    }
  ],
  "status": "available"
}
```

## Docker deployment

This application also includes a Dockerfile. If you're running Windows or OSX, you can use [Docker Machine](https://docs.docker.com/machine) to run it locally or deploy it to Apcera or AWS. I run through all those scenarios below.

### Running on Docker Machine
The instructions here are just enough to get started. I encourage you to take a deeper look at the Docker [docs](https://docs.docker.com/engine/examples/nodejs_web_app/) for more details.  I also highly recommend using [NodeSource](https://github.com/nodesource/distributions) Docker images to source your project.  I've defined them in my Dockerfile (e.g., `FROM nodesource/trusty:4.2.3`).

1. After installing Docker Machine, you will want to start up an environment and then configure it to be used by the Docker client. Here are the necessary commands to do that:

    ```
    $ docker-machine create --driver virtualbox dev // dev is the environment name you choose
    $ eval "$(docker-machine env dev)"
    $ docker ps
    $ docker-machine env dev //sets all the necessary env variables
    ```
2. Now that Docker Machine is configured, you can use the Docker client to build and run the app:

    ```
    $ docker build -t lsacco/swagger-rest .
    $ docker run -it -p 8080:8080 lsacco/swagger-rest
    ```
3. Now determine the IP address of your docker-machine and replace the host url in the `JSONClient` in `test/swagger-test.js` so you can run the Mocha tests to validate it:

    ```
    $ docker-machine ip dev
    $ mocha //should all return succesful
    ```

### Running on Apcera with Docker

Now we can take the same docker image and deploy it to [Apcera](https://community.qualcomm.com/groups/runq-product-management/projects/apcera-platform). Please see the community on how to set-up an account on Apcera and how to install the CLI client I reference in the following steps.

1. Tag the local image to the Qualcomm repository (see [here](https://community.qualcomm.com/groups/docker) on how to get started with the Qualcomm docker registry):
    ```bash
    $ docker tag -f lsacco/swagger-rest:latest docker-registry.qualcomm.com/lsacco/swagger-rest:1.0.0
    $ docker images //verify the image is there
    $ docker push docker-registry.qualcomm.com/lsacco/swagger-rest:1.0.0
    ```
    
2. Now that the image is deployed to the registry, you can use the Apcera CLI `apc` to deploy it to your namespace:
    ```bash
    $ apc docker run swagger-rest --image https://docker-registry.qualcomm.com/lsacco/swagger-rest:1.0.0
    $ apc service bind /apcera::outside-http -job swagger-rest  // Allows access to external swagger service
    $ apc route add swagger-rest.lsacco.sandbox.runq.runq-uw2-c.qualcomm.com --app swagger-rest -http --port 8080  // Binds port 80 to the internally exposed Docker port 8080
    $ apc job logs swagger-rest //review logs of start-up
    ```
    
3. Next update the Mocha tests, similar to the last section, with the hostname provided on line 3 in step 2.  You should see output from tailing the logs and the tests should pass.

### Running on Apcera with Manifest

Apcera also provides a means to run the app *natively* using its own Node.js provider.  

> One thing to note is that you will want to be sure that the Node version you define in your `package.json` is available on Apcera.  You can check that available versions by running `apc package list -ns /runq/pkg/runtimes | grep node`.

I've also included my `continuum.conf`, which is the [Apcera manifest file](http://docs.apcera.com/jobs/manifests/) used to run the app on Apcera.  You'll want to update this file to match settings for your own environment. The nice thing about this approach is that I can bind the outside-http service provider and set the route as follows instead of having to run explicit commands as I did with the docker deploy:

```
services [
  {
    service_name: "/apcera::outside-http",
    type: "network"
  }
]

ports: [
  {
    number: 8080,
    routes: [
      {
        type: "http",
        endpoint: "swagger-rest.lsacco.sandbox.runq.runq-uw2-c.qualcomm.com"
      }
    ]
  }
]
```

Here are the `apc` commands required to deploy it, first deleting the old job we deployed for docker, if necessary:

```bash
$ apc jobs delete swagger-rest
$ apc app create
$ apc job logs swagger-rest
```

### Running on AWS EC2 Container Services (ECS)

The other option I tried was running on [ECS](http://docs.aws.amazon.com/AmazonECS/latest/developerguide/ECS_GetStarted.html). Once you have an ECS cluster configured and a task definition for your Docker image, you can run the following commands to push your image out as a service:

```bash
 $ aws ecs create-service --cluster demo-ecs --task-definition swagger-rest:1 --desired-count 1 --service-name swagger-rest
 $ aws ecs describe-services --cluster demo-ecs
 $ mocha
```