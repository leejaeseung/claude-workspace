package com.ticketrush.order.repository

import com.ticketrush.order.entity.OrderEntity
import org.springframework.data.jpa.repository.JpaRepository

interface OrderRepository : JpaRepository<OrderEntity, Long>
