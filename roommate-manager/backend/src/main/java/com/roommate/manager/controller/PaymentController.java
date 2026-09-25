package com.roommate.manager.controller;

import com.roommate.manager.entity.Payment;
import com.roommate.manager.entity.Room;
import com.roommate.manager.entity.User;
import com.roommate.manager.exception.ApiException;
import com.roommate.manager.repository.PaymentRepository;
import com.roommate.manager.repository.RoomRepository;
import com.roommate.manager.repository.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class PaymentController {

    private final PaymentRepository paymentRepository;
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;

    public PaymentController(PaymentRepository paymentRepository,
                           RoomRepository roomRepository,
                           UserRepository userRepository) {
        this.paymentRepository = paymentRepository;
        this.roomRepository = roomRepository;
        this.userRepository = userRepository;
    }

    @GetMapping("/payments")
    public ResponseEntity<List<Payment>> getPayments(@RequestParam(required = false) Long roomId) {
        User currentUser = getCurrentUser();
        Room room = getUserRoom(currentUser, roomId);
        return ResponseEntity.ok(paymentRepository.findByRoomOrderByPaymentDateDesc(room));
    }

    @PostMapping("/payments")
    public ResponseEntity<?> createPayment(@Valid @RequestBody Map<String, Object> request) {
        User currentUser = getCurrentUser();
        Long roomId = Long.valueOf(request.get("roomId").toString());
        Room room = roomRepository.findById(roomId)
            .orElseThrow(() -> new ApiException("Room not found."));

        if (!room.getCreatedBy().getId().equals(currentUser.getId())) {
            throw new ApiException("You are not authorized to add payment for this room.");
        }

        String payerEmail = request.get("payerEmail") != null ? request.get("payerEmail").toString() : null;
        String receiverEmail = request.get("receiverEmail") != null ? request.get("receiverEmail").toString() : null;
        BigDecimal amount = request.get("amount") != null ? new BigDecimal(request.get("amount").toString()) : BigDecimal.ZERO;

        if (payerEmail == null || receiverEmail == null) {
            throw new ApiException("Payer and receiver are required.");
        }

        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ApiException("Payment amount must be greater than zero.");
        }

        User payer = userRepository.findByEmail(payerEmail.trim().toLowerCase())
            .orElseThrow(() -> new ApiException("Payer not found."));
        User receiver = userRepository.findByEmail(receiverEmail.trim().toLowerCase())
            .orElseThrow(() -> new ApiException("Receiver not found."));

        Payment payment = new Payment();
        payment.setRoom(room);
        payment.setPayer(payer);
        payment.setReceiver(receiver);
        payment.setAmount(amount);
        payment.setPaymentDate(LocalDate.now());
        payment.setPaymentMethod(request.get("paymentMethod").toString());
        payment.setNote(request.get("note") != null ? request.get("note").toString() : "");

        Payment savedPayment = paymentRepository.save(payment);
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Payment recorded successfully.");
        response.put("payment", savedPayment);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    private Room getUserRoom(User currentUser, Long roomId) {
        if (roomId == null) {
            List<Room> rooms = roomRepository.findByCreatedBy(currentUser);
            if (rooms.isEmpty()) {
                throw new ApiException("No room found for this user.");
            }
            return rooms.get(0);
        }

        Room room = roomRepository.findById(roomId)
            .orElseThrow(() -> new ApiException("Room not found."));

        if (!room.getCreatedBy().getId().equals(currentUser.getId())) {
            throw new ApiException("Unauthorized access.");
        }

        return room;
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ApiException("Unauthorized user.");
        }

        String email = authentication.getName();
        return userRepository.findByEmail(email)
            .orElseThrow(() -> new ApiException("User not found."));
    }
}
