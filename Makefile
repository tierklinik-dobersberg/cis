REPO ?= registry.admin.dobersberg.vet

.PHONY: frontend-staging-container backend-staging-container

frontend-staging-container:
	docker build -t $(REPO)/cis-frontend:staging  ./ui

frontend-staging: frontend-staging-container
	docker push $(REPO)/cis-frontend:staging

backend-staging-container:
	docker build -t $(REPO)/cis-backend:staging  .

backend-staging: backend-staging-container
	docker push $(REPO)/cis-backend:staging

staging: backend-staging frontend-staging
	nomad job scale cis-staging 0
	nomad job scale cis-staging 1
