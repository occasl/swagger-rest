import groovy.transform.Field
import hudson.model.*

/*  ----------------
 *  Global variables
 *  ----------------
 */

// Change these variables for your project
@Field def GITHUB_PROJECT = "https://github.qualcomm.com/lsacco/swagger-rest.git"
@Field def DOCKER_APPLICATION_IMAGE = "https://docker-registry.qualcomm.com/lsacco/swagger-rest"
@Field def APPLICATION_NAME = "swagger-rest"
@Field def DOCKER_TAG = "lsacco/" + APPLICATION_NAME
@Field def DOCKER_APPLICATION_TAG = "latest"
@Field def DOCKER_CONTAINER_NAME = APPLICATION_NAME + "_" + System.currentTimeMillis()
@Field def EMAIL_PROJECT = "lsacco@qualcomm.com"
@Field def SSATSVC_CREDENTIALS_ID = "apc-ssatsvc"
@Field def QUAY_CREDENTIALS_ID = "apc-quay"
@Field def APC_NAMESPACE = "/runq/team/runq-apc-jenkins/qual"

// Standard Config
@Field def MASTER_NODE = "master"
@Field def SLAVE_NODE = "slave"
@Field def SLAVE_NAME = "jenkins-slave-" + System.currentTimeMillis()
@Field def APPLICATION_DOMAIN = ".runq-sd-d.qualcomm.com"
@Field def DOCKER_MACHINE_HOSTNAME = "tcp://docker-machine.qualcomm.com:4243"
@Field def DOCKER_SLAVE_IMAGE = "https://docker-registry.qualcomm.com/lsacco/jenkins-slave"
@Field def DOCKER_SLAVE_TAG = "1.6" // Must use slave with docker.io installed
@Field def APC_CLUSTER_ID = "https://runq-sd-d.qualcomm.com"
@Field def APC_VERSION = "0.28.2"
@Field def APC_VIRTUAL_NETWORK = APC_NAMESPACE + "::" + "jenkins-apc-network"
@Field def APC_SLAVE_DOCKER_JOB_NAME = APC_NAMESPACE + "::" + SLAVE_NAME

/*  ------------------
 *  Flow Orchestration
 *  ------------------
 */

// Prepare master and slave
stage "Initialize"
node( MASTER_NODE ) {
    echo "Initializing workflow"
    deploySlave()
}

stage "DEV Deploy"
node( SLAVE_NODE ) {
    echo "Deploying to Develop"
    deployApp('dev')
}

stage "Integration Test"
node( SLAVE_NODE ) {
    echo "Executing tests"
    runTests('dev')
}

stage "Publish Docker Image"
node( SLAVE_NODE ) {
    echo "Docker Publish"
    dockerDeploy()
}

stage "QA Deploy"
node( SLAVE_NODE ) {
    echo "Deploying to Test"
    deployApp('test')
}

def deployed = true
stage "PROD Deploy"
node( SLAVE_NODE ) {
    echo "Deploying to PROD"
    emailNotification("Job '${env.JOB_NAME}' (${env.BUILD_NUMBER}): Ready to deploy to PROD")
    try {
        timeout(time: 1, unit: 'DAYS') {
            input 'Deploy to Production?'
        }
        deployApp('prod')
    } catch (e) {
        // Set to false so slave can be decommissioned in stage below
        deployed = false
    }
}

stage "Smoke Test"
node(SLAVE_NODE) {
    // Skip smoke tests if not deployed
    if (deployed) {
        echo "Executing PROD Smoke tests"
        runTests('prod')
    }
}

// Finalize
stage "Finalize"
node( MASTER_NODE ) {
    echo "Finalizing workflow job"
    undeploySlave()
    if (deployed) {
        emailNotification("Deployed Job '${env.JOB_NAME}' (${env.BUILD_NUMBER}) to PROD")
    } else {
        emailNotification("Job '${env.JOB_NAME}' (${env.BUILD_NUMBER}): Not deployed to PROD")
    }
}

// Teardown environment Example using parallel keyword
//stage "Teardown"
//echo "Tearing down environments"
//parallel undeployDEV: {
//    node( SLAVE_NODE ) {
//        undeployApp('dev')
//    }
//}, undeployTEST: {
//    node( SLAVE_NODE ) {
//        undeployApp('test')
//    }
//}, undeployPROD: {
//    node( SLAVE_NODE ) {
//        undeployApp('prod')
//    }
//}, failFast: true

/*  ----------------
 *  Helper Functions
 *  ----------------
 */

def connectApc() {
    withCredentials([[$class: 'UsernamePasswordMultiBinding', credentialsId: SSATSVC_CREDENTIALS_ID,
                      usernameVariable: 'APC_USERNAME', passwordVariable: 'APC_PASSWORD']]) {
        sh '''
	    # set -x
	    # for debugging
	    apc version
	    expect -v

	    # target the Apcera cluster
	    apc target ''' + APC_CLUSTER_ID + '''
	    # login to Apcera cluster
	    expect -c '
	        spawn apc logout
	        wait
	        expect "Successfully logged out!"
	        spawn apc login --ldap-basic
	        expect "*?sername:"
	        send "''' + env.APC_USERNAME + '''\r"
	        expect "*?assword:"
	        send "''' + env.APC_PASSWORD + '''\r"
	        wait
	        expect "*Login successful."
	        close
	    '

	    # set the Apcera namespace
	    apc namespace ''' + APC_NAMESPACE + '''

        '''
    }
}

def deploySlave() {
    connectApc()

    withCredentials([[$class: 'UsernamePasswordMultiBinding', credentialsId: SSATSVC_CREDENTIALS_ID,
                      usernameVariable: 'SSATSVC_USERNAME', passwordVariable: 'SSATSVC_PASSWORD']]) {
        sh '''
            # set -x

            # get the Jenkins master container IP address
            export jenkins_master_ip=$(ip addr | grep 'state UP' -A2 | tail -n1 | awk '{print $2}' | cut -f1  -d'/')
            echo "Jenkins Master container IP is $jenkins_master_ip"

            # set AWS environment variables so we can pass them to the Apcera slave job
            export AWS_ACCESS_KEY_ID=$(aws configure get aws_access_key_id)
            export AWS_SECRET_ACCESS_KEY=$(aws configure get aws_secret_access_key)
            export AWS_DEFAULT_REGION=$(aws configure get region)

            # create the slave Docker job in Apcera
            apc docker create ''' + SLAVE_NAME + ''' --image ''' + DOCKER_SLAVE_IMAGE + ''' --tag ''' + DOCKER_SLAVE_TAG + ''' --disk 400MB --memory 1GB --ignore-volumes --allow-egress --env-set "JENKINS_PORT_8080_TCP_ADDR=$jenkins_master_ip" --env-set "JENKINS_PORT_8080_TCP_PORT=8080" --env-set "PARAMS=-name ''' + SLAVE_NAME + '''  -labels ''' + SLAVE_NODE + ''' -executors 3 -username ''' + env.SSATSVC_USERNAME + ''' -password ''' + env.SSATSVC_PASSWORD +''' "

        '''
    }

    // join the jobs to the same virtual network as the master
    joinNetwork (APC_VIRTUAL_NETWORK, APC_SLAVE_DOCKER_JOB_NAME)

    // Start Job
    sh '''apc job start ''' + SLAVE_NAME
}

def undeploySlave() {
    echo "Undeploying slave node"

    // remove the slave from Apcera virtual network
    try {
        leaveNetwork( APC_VIRTUAL_NETWORK, APC_SLAVE_DOCKER_JOB_NAME )
    } catch (e) {
        echo 'Error leaving network'
        emailError()
    }

    // delete the slave Docker Job
    try {
        deleteJob( APC_SLAVE_DOCKER_JOB_NAME )
    } catch (e) {
        echo 'Error deleting job'
        emailError()
    }

    // remove the slave node from the Jenkins cluster
    try {
        for (node in Hudson.instance.nodes) {
            if (node.name.startsWith( SLAVE_NAME )) {
                Hudson.instance.removeNode(node)
            }
        }
    } catch (e) {
        //TODO falls in catch block but removes slave successfully :/
//        echo 'Error removing slave'
//        emailError()
    }
}

def deployApp(env) {
    connectApc()

    echo "Deploying apps to " + env
    def appName = (env == 'prod' ? APPLICATION_NAME : APPLICATION_NAME + '-' + env)
    def appDomain = 'http://' + appName + APPLICATION_DOMAIN
    echo "Deploying app " + appName

    // create the Docker job in Apcera
    sh '''
        APP_NAME_A=''' + appName + '''-a
        APP_NAME_B=''' + appName + '''-b

        JOBS=`apc jobs list -ns ''' + APC_NAMESPACE + '''`

        if test "${JOBS#*$APP_NAME_A}" != "$JOBS" ; then
            export DELETE_JOB=$APP_NAME_A
            export APP_NAME=$APP_NAME_B
        else
            export APP_NAME=$APP_NAME_A

            if test "${JOBS#*$APP_NAME_B}" != "$JOBS" ; then
                export DELETE_JOB=$APP_NAME_B
            fi
        fi

        apc docker create $APP_NAME --image ''' + DOCKER_APPLICATION_IMAGE + ''' --tag ''' + DOCKER_APPLICATION_TAG + ''' --disk 300MB --memory 256MB --ignore-volumes  --allow-egress --routes ''' + appDomain + ''' --port 8080

        echo "Join virtual network..."
        apc network join ''' + APC_VIRTUAL_NETWORK + ''' --job $APP_NAME

        apc job start $APP_NAME

        #Terminate Previous Deployment
        if [ ! -z $DELETE_JOB ] ; then
            echo "Deleting Job: " + $DELETE_JOB
            apc network leave ''' + APC_VIRTUAL_NETWORK + ''' --job $DELETE_JOB
            apc job stop $DELETE_JOB
            apc job delete $DELETE_JOB --batch
        fi
    '''

}

def runTests(env) {
    echo "Testing apps on " + env
    def appName = (env == 'prod' ? APPLICATION_NAME : APPLICATION_NAME + '-' + env)
    def appDomain = 'http://' + appName + APPLICATION_DOMAIN

    // Use try/catch if you want to continue with notification only even if tests fail
    try {
        git GITHUB_PROJECT
        sh '''
            npm config set registry="http://registry.npmjs.org/"
            npm install
            ./node_modules/grunt-cli/bin/grunt
            export APPLICATION_HOSTNAME=''' + appDomain + '''
            export MOCHA_FILE=./jenkins-test-results.xml
            ./node_modules/.bin/mocha test/** --reporter mocha-junit-reporter > test-reports.xml
        '''
        archive 'jenkins-test-results.xml'
        step $class: 'hudson.tasks.junit.JUnitResultArchiver', testResults: '**/*.xml'
    } catch (e) {
        def msg = 'Error running tests (do you have the right APPLICATION_HOSTNAME set?) : ' + e.stack
        echo msg
        emailError(msg)
    }
}

def dockerDeploy() {
    git GITHUB_PROJECT

    docker.withServer(DOCKER_MACHINE_HOSTNAME) {
        def image = docker.build(DOCKER_TAG, '.')

        // Test container then stop and remove it
        def container = image.run('--name ' + DOCKER_CONTAINER_NAME)
        container.stop()

        docker.withRegistry(DOCKER_APPLICATION_IMAGE, QUAY_CREDENTIALS_ID ) {
            image.push(DOCKER_APPLICATION_TAG)
        }
    }
}

def joinNetwork(network, job) {
    echo "Joining job ${job} to network ${network} in Apcera"
    sh "apc network join " + network + " --job " + job

}

def leaveNetwork(network, job) {
    echo "Removing job ${job} from network ${network} in Apcera"
    sh "apc network leave " + network + " --job " + job
}

def deleteJob(job) {
    echo "Deleting job ${job} in Apcera"
    sh "apc app delete " + job + " --batch"
}

def emailNotification(msg) {
    mail (to: EMAIL_PROJECT,
            subject: "${msg}",
            body: "Please go to ${env.BUILD_URL}.")
}

def emailError(msg) {
    mail (to: EMAIL_PROJECT,
            subject: "ERROR in Job '${env.JOB_NAME}' (${env.BUILD_NUMBER})",
            body: "Please go to ${env.BUILD_URL}: " + msg)
}