build:
	docker build -t access-log-ui .

run:
	docker run -p 3000:3000 -e USE_MOCK_DATA=false -e LOG_FILE_PATH=data/access-json.log access-log-ui