package com.ticketrush.order

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication
@EnableScheduling
class OrderApplication

fun main(args: Array<String>) {
    runApplication<OrderApplication>(*args)
}
