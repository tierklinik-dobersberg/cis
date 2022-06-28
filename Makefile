REPO ?= registry.admin.dobersberg.vet

.PHONY: frontend-staging-container backend-staging-container import-util-container

frontend-staging-container:
	docker build -t $(REPO)/cis-frontend:staging -f ./dockerfiles/Dockerfile-frontend ./ui

frontend-staging: frontend-staging-container
	docker push $(REPO)/cis-frontend:staging

backend-staging-container:
	docker build -t $(REPO)/cis-backend:staging -f ./dockerfiles/Dockerfile-cisd .

backend-staging: backend-staging-container
	docker push $(REPO)/cis-backend:staging

import-util-container:
	docker build -t $(REPO)/cis-import-util:staging -f ./dockerfiles/Dockerfile-import-util .

import-util-staging: import-util-container
	docker push $(REPO)/cis-import-util:staging

staging: backend-staging frontend-staging
	nomad job scale cis-staging 0
	nomad job scale cis-staging 1
