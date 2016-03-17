import groovy.transform.Field
import hudson.model.*

import org.jenkinsci.plugins.scriptsecurity.sandbox.groovy.SecureGroovyScript
import org.jenkinsci.plugins.scriptsecurity.sandbox.whitelists.Whitelisted
import org.jenkinsci.plugins.scriptsecurity.scripts.ApprovalContext
import org.jenkinsci.plugins.scriptsecurity.scripts.ClasspathEntry

/*  ----------------
 *  Global variables
 *  ----------------
 */
@Field def MASTER_NODE = "master"
@Field def SLAVE_NODE = "slave"
@Field def SLAVE_NAME = "jenkins-slave-" + System.currentTimeMillis()
@Field def APPLICATION_NAME = "swagger-rest"
@Field def APPLICATION_DOMAIN = ".runq-sd-d.qualcomm.com"
@Field def DOCKER_REGISTRY = "https://docker-registry.qualcomm.com"
@Field def DOCKER_SLAVE_IMAGE = "https://docker-registry.qualcomm.com/lsacco/jenkins-slave"
@Field def DOCKER_SLAVE_TAG = "1.4"
@Field def APC_CLUSTER_ID = "https://runq-sd-d.qualcomm.com"
@Field def APC_VERSION = "0.28.2"
@Field def APC_NAMESPACE = "/runq/team/runq-apc-ssat/qual"
@Field def APC_VIRTUAL_NETWORK = APC_NAMESPACE + "::" + "jenkins-network"
@Field def APC_SLAVE_DOCKER_JOB_NAME = APC_NAMESPACE + "::" + SLAVE_NAME

// Change these variables for your project

@Field def GITHUB_PROJECT = "https://github.qualcomm.com/lsacco/swagger-rest.git"
@Field def DOCKER_APPLICATION_IMAGE = "https://docker-registry.qualcomm.com/lsacco/swagger-rest"
@Field def DOCKER_APPLICATION_TAG = "latest"
@Field def EMAIL_PROJECT = "lsacco@qualcomm.com"
@Field def SSATSVC_CREDENTIALS_ID = "apc-ssatsvc"


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

// Teardown environment
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

stage "DEV Deploy"
node( SLAVE_NODE ) {
    echo "Deploying to Develop"
    deployApp('dev')
}

stage "Test"
node( SLAVE_NODE ) {
    echo "Executing tests"
//    runTests('dev')
}

stage "Publish Docker Image"
node( SLAVE_NODE ) {
    echo "Docker Publish"
    dockerDeploy()
}

stage "TEST Deploy"
node( SLAVE_NODE ) {
    echo "Deploying to Test"
    deployApp('test')
}

stage "PROD Deploy"
node( SLAVE_NODE ) {
    echo "Deploying to PROD"
    mail (to: EMAIL_PROJECT,
            subject: "Job '${env.JOB_NAME}' (${env.BUILD_NUMBER}) is ready to deploy to PROD",
            body: "Please go to ${env.BUILD_URL}.")
    input 'Deploy to Production?'
    deployApp('prod')
}

stage "Smoke Test"
node( SLAVE_NODE ) {
    echo "Executing PROD Smoke tests"
    runTests('prod')
}

// Finalize
stage "Finalize"
node( MASTER_NODE ) {
    echo "Finalizing workflow job"
    undeploySlave()
    mail (to: EMAIL_PROJECT,
            subject: "Job '${env.JOB_NAME}' (${env.BUILD_NUMBER}) successfully deployed to PROD",
            body: "Please go to ${env.BUILD_URL}.")
}

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
            apc docker create ''' + SLAVE_NAME + ''' --image ''' + DOCKER_SLAVE_IMAGE + ''' --tag ''' + DOCKER_SLAVE_TAG + ''' --disk 400MB --memory 1GB --ignore-volumes --allow-egress --env-set "JENKINS_PORT_8080_TCP_ADDR=$jenkins_master_ip" --env-set "JENKINS_PORT_8080_TCP_PORT=8080" --env-set "PARAMS=-name ''' + SLAVE_NAME + '''  -labels ''' + SLAVE_NODE + ''' -executors 4 -username ''' + env.SSATSVC_USERNAME + ''' -password ''' + env.SSATSVC_PASSWORD +''' "

        '''
    }

    // join the jobs to the same virtual network as the master
    joinNetwork (APC_VIRTUAL_NETWORK, APC_SLAVE_DOCKER_JOB_NAME)

    // Start Job
    sh '''apc job start ''' + SLAVE_NAME
}

@Whitelisted
def undeploySlave() {
    echo "Undeploying slave node"

    // remove the slave from Apcera virtual network
    try {
        leaveNetwork( APC_VIRTUAL_NETWORK, APC_SLAVE_DOCKER_JOB_NAME )
    } catch (e) {
        emailError(e.getMessage())
        echo e.getMessage()
    }

    // stop the slave Docker job
    try {
        stopJob( APC_SLAVE_DOCKER_JOB_NAME )
    } catch (e) {
        emailError(e.getMessage())
        echo e.getMessage()
    }

    // delete the slave Docker Job
    try {
        deleteJob( APC_SLAVE_DOCKER_JOB_NAME )
    } catch (e) {
        emailError(e.getMessage())
        echo e.getMessage()
    }

    // remove the slave node from the Jenkins cluster
    try {
        for (node in Hudson.instance.nodes) {
            if (node.name.startsWith( SLAVE_NAME )) {
                Hudson.instance.removeNode(node)
            }
        }
    } catch (e) {
        emailError(e.getMessage())
        echo e.getMessage()
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
            expect -c '
                spawn apc job delete $env(DELETE_JOB)
                expect "Delete job *:"
                send "y\r"
                wait
                expect "Success!"
                close
            '

        fi
    '''

}

@Whitelisted
def undeployApp(env) {
    echo "Undeploying apps on " + env
    def appName = (env == 'prod' ? APPLICATION_NAME : APPLICATION_NAME + '-' + env)
    def appDockerJobName = APC_NAMESPACE + "::" + appName

    // remove the application from Apcera virtual network
    try {
        leaveNetwork( APC_VIRTUAL_NETWORK, appDockerJobName )
    } catch (e) {
        emailError(e.getMessage())
        echo e.getMessage()
    }

    // stop the application Docker job
    try {
        stopJob( appDockerJobName )
    } catch (e) {
        emailError(e.getMessage())
        echo e.getMessage()
    }

    // delete the application Docker Job
    try {
        deleteJob( appDockerJobName )
    } catch (e) {
        emailError(e.getMessage())
        echo e.getMessage()

    }
}

@Whitelisted
def runTests(env) {
    connectApc()
    echo "Testing apps on " + env
    def appName = (env == 'prod' ? APPLICATION_NAME : APPLICATION_NAME + '-' + env)
    def appDomain = 'http://' + appName + APPLICATION_DOMAIN

    try {
        sh '''
        apc app connect ''' + SLAVE_NAME + '''
        if [ ! -d swagger-rest ] ; then
            git clone ''' + GITHUB_PROJECT + ''' --branch develop --single-branch
        fi
        cd swagger-rest
        npm config set registry="http://registry.npmjs.org/"
        npm install
        ./node_modules/grunt-cli/bin/grunt
        export APPLICATION_HOSTNAME=''' + appDomain + '''
        export MOCHA_FILE=./jenkins-test-results.xml
        ./node_modules/.bin/mocha test/** --reporter mocha-junit-reporter
    '''
        archive 'jenkins-test-results.xml'
        step $class: 'hudson.tasks.junit.JUnitResultArchiver', testResults: '**/*.xml'

    } catch (e) {
        emailError(e.getMessage())
        echo e.getMessage()
    }
}

@Whitelisted
def dockerDeploy() {
    withEnv(['HOME='+pwd()]) {
        docker.withRegistry('https://docker-registry.qualcomm.com/lsacco/swagger-rest', SSATSVC_CREDENTIALS_ID) {
//        def image = docker.image(APPLICATION_NAME)
//        image.tag("latest")
//        image.push()
            docker.build(APPLICATION_NAME).push('latest')
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

def stopJob(job) {
    echo "Stopping job ${job} in Apcera"
    sh "apc app stop " + job
}

def deleteJob(job) {
    echo "Deleting job ${job} in Apcera"
    sh '''
        expect -c '
    	    spawn apc app delete ''' + job + '''
    	    expect "Delete application*:"
    	    send "y\r"
    	    wait
    	    expect "Success!"
    	    close
        '
    '''
}

def emailError(msg) {
    mail (to: EMAIL_PROJECT,
            subject: "Job '${env.JOB_NAME}' (${env.BUILD_NUMBER}) resulted in an error",
            body: "${msg}//nPlease go to ${env.BUILD_URL}.")
}