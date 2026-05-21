pipeline {
    agent any

    environment {
        COMPOSE_FILE = 'docker-compose.prod.yml'
        // The workspace mount path inside the Jenkins container (set in docker-compose.prod.yml)
        PROJECT_DIR  = '/workspace/bookvella'
    }

    options {
        // Keep only the last 10 builds
        buildDiscarder(logRotator(numToKeepStr: '10'))
        // Abort if the build takes longer than 20 minutes
        timeout(time: 20, unit: 'MINUTES')
        // Don't run concurrent builds
        disableConcurrentBuilds()
    }

    stages {

        stage('Checkout') {
            steps {
                // Pull the latest code from the branch that triggered the build
                checkout scm
            }
        }

        stage('Verify environment') {
            steps {
                sh '''
                    docker --version
                    docker compose version
                    test -f ${PROJECT_DIR}/.env.production || \
                        { echo "ERROR: .env.production not found on VPS. Create it first."; exit 1; }
                '''
            }
        }

        stage('Build images') {
            steps {
                sh '''
                    cd ${PROJECT_DIR}
                    docker compose -f ${COMPOSE_FILE} build --pull --no-cache api web
                '''
            }
        }

        stage('Run DB migrations') {
            steps {
                sh '''
                    cd ${PROJECT_DIR}
                    docker compose -f ${COMPOSE_FILE} run --rm \
                        -e DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d= -f2-) \
                        api node dist/src/main.js --migrate-only || \
                    docker compose -f ${COMPOSE_FILE} run --rm api \
                        sh -c "npx prisma migrate deploy"
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    cd ${PROJECT_DIR}
                    # Bring up updated containers; postgres, nginx, certbot stay running
                    docker compose -f ${COMPOSE_FILE} up -d --no-deps api web
                    # Remove dangling images to keep disk clean
                    docker image prune -f
                '''
            }
        }

        stage('Health check') {
            steps {
                // Give the API a moment to start, then verify it's alive
                sh '''
                    sleep 15
                    cd ${PROJECT_DIR}
                    docker compose -f ${COMPOSE_FILE} ps
                    docker compose -f ${COMPOSE_FILE} exec -T api \
                        node -e "fetch('http://localhost:3000/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" \
                        || { echo "API health check failed!"; exit 1; }
                    echo "✅ Deployment successful"
                '''
            }
        }
    }

    post {
        failure {
            echo "❌ Build #${BUILD_NUMBER} failed. Check the logs above."
        }
        success {
            echo "✅ Build #${BUILD_NUMBER} deployed successfully."
        }
    }
}
