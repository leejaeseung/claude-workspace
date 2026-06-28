rootProject.name = "ticketrush"

include(
    ":core-domain",
    ":event-contract",
    ":infra-kafka",
    ":infra-redis",
    ":infra-jpa",
    ":queue-api",
    ":seat-api",
    ":order-api",
    ":payment-api",
    ":notification-api"
)
