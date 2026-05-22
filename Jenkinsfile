pipeline {
    agent any

    environment {
        COMPOSE_FILE = 'docker-compose.prod.yml'
        COMPOSE_PROJECT_NAME = 'bookvella'
        // Persistent server-only secrets live in the mounted deploy directory.
        SECRET_ENV_FILE = '/workspace/bookvella/.env'
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
                    test -f "${SECRET_ENV_FILE}" || \
                        { echo "ERROR: .env not found on VPS. Create it first."; exit 1; }
                    # Copy to the job workspace so docker compose can find it.
                    # Docker compose auto-loads .env for ${VAR} YAML interpolation AND
                    # env_file: .env loads it into each container at runtime — one file, both jobs.
                    cp "${SECRET_ENV_FILE}" "${WORKSPACE}/.env"
                '''
            }
        }

        stage('Build images') {
            steps {
                sh '''
                    cd "${WORKSPACE}"
                    docker compose -p "${COMPOSE_PROJECT_NAME}" -f "${COMPOSE_FILE}" build --pull --no-cache api web
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    cd "${WORKSPACE}"
                    # Bring up updated containers; postgres, nginx, certbot stay running
                    docker compose -p "${COMPOSE_PROJECT_NAME}" -f "${COMPOSE_FILE}" up -d --no-deps api web
                    # Remove dangling images to keep disk clean
                    docker image prune -f
                '''
            }
        }

        stage('Health check') {
            steps {
                // Poll Docker's own healthcheck status (includes migration time) instead of
                // a fixed sleep that may expire before prisma migrate deploy finishes.
                sh '''
                    cd "${WORKSPACE}"
                    echo "Waiting up to 120 s for the API to become healthy..."
                    i=0
                    while [ $i -lt 24 ]; do
                        STATUS=$(docker inspect --format="{{.State.Health.Status}}" \
                            "$(docker compose -p "${COMPOSE_PROJECT_NAME}" -f "${COMPOSE_FILE}" ps -q api)" 2>/dev/null || echo "starting")
                        if [ "$STATUS" = "healthy" ]; then
                            echo "✅ API healthy after $((i * 5)) s"
                            break
                        fi
                        i=$((i + 1))
                        if [ $i -eq 24 ]; then
                            echo "❌ Timed out waiting for healthy API"
                            docker compose -p "${COMPOSE_PROJECT_NAME}" -f "${COMPOSE_FILE}" logs --tail=50 api
                            exit 1
                        fi
                        echo "  ${i}/24 – status: ${STATUS}"
                        sleep 5
                    done
                    docker compose -p "${COMPOSE_PROJECT_NAME}" -f "${COMPOSE_FILE}" ps
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
