package com.roommate.manager.repository;

import com.roommate.manager.entity.Payment;
import com.roommate.manager.entity.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findByRoomOrderByPaymentDateDesc(Room room);
}
