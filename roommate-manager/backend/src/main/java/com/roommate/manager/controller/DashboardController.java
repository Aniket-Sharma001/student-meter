package com.roommate.manager.controller;

import com.roommate.manager.entity.*;
import com.roommate.manager.exception.ApiException;
import com.roommate.manager.repository.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class DashboardController {

    private final UserRepository userRepository;
    private final RoomRepository roomRepository;
    private final RoomMemberRepository roomMemberRepository;
    private final ExpenseRepository expenseRepository;
    private final PaymentRepository paymentRepository;

    public DashboardController(UserRepository userRepository,
                              RoomRepository roomRepository,
                              RoomMemberRepository roomMemberRepository,
                              ExpenseRepository expenseRepository,
                              PaymentRepository paymentRepository) {
        this.userRepository = userRepository;
        this.roomRepository = roomRepository;
        this.roomMemberRepository = roomMemberRepository;
        this.expenseRepository = expenseRepository;
        this.paymentRepository = paymentRepository;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboard(@RequestParam(required = false) Long roomId) {
        User currentUser = getCurrentUser();
        Room room = getUserRoom(currentUser, roomId);

        List<RoomMember> members = roomMemberRepository.findByRoom(room);
        List<Expense> expenses = expenseRepository.findByRoomOrderByExpenseDateDesc(room);
        List<Payment> payments = paymentRepository.findByRoomOrderByPaymentDateDesc(room);

        BigDecimal monthlyRent = room.getMonthlyRent() != null ? room.getMonthlyRent() : BigDecimal.ZERO;
        BigDecimal electricityBill = expenses.stream()
            .filter(e -> "Electricity".equalsIgnoreCase(e.getCategory()))
            .map(Expense::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalMonthlyExpenses = expenses.stream()
            .map(Expense::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal myPaidAmount = payments.stream()
            .filter(p -> p.getPayer().getId().equals(currentUser.getId()))
            .map(Payment::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal myPendingAmount = totalMonthlyExpenses.divide(BigDecimal.valueOf(Math.max(1, members.size())), 2, java.math.RoundingMode.HALF_UP)
            .subtract(myPaidAmount)
            .max(BigDecimal.ZERO);

        List<Map<String, Object>> recentExpenses = new ArrayList<>();
        for (Expense expense : expenses.stream().limit(5).toList()) {
            Map<String, Object> item = new HashMap<>();
            item.put("title", expense.getTitle());
            item.put("category", expense.getCategory());
            item.put("amount", expense.getAmount());
            item.put("paidBy", expense.getPaidBy().getFullName());
            recentExpenses.add(item);
        }

        List<Map<String, Object>> recentPayments = new ArrayList<>();
        for (Payment payment : payments.stream().limit(5).toList()) {
            Map<String, Object> item = new HashMap<>();
            item.put("payer", payment.getPayer().getFullName());
            item.put("receiver", payment.getReceiver().getFullName());
            item.put("amount", payment.getAmount());
            item.put("paymentMethod", payment.getPaymentMethod());
            recentPayments.add(item);
        }

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalExpenses", totalMonthlyExpenses);
        summary.put("pendingAmount", myPendingAmount);
        summary.put("paidAmount", myPaidAmount);

        Map<String, Object> dashboard = new HashMap<>();
        dashboard.put("roomName", room.getRoomName());
        dashboard.put("totalRoomMembers", members.size());
        dashboard.put("monthlyRent", monthlyRent);
        dashboard.put("electricityBill", electricityBill);
        dashboard.put("totalMonthlyExpenses", totalMonthlyExpenses);
        dashboard.put("myPaidAmount", myPaidAmount);
        dashboard.put("myPendingAmount", myPendingAmount);
        dashboard.put("recentExpenses", recentExpenses);
        dashboard.put("recentPayments", recentPayments);
        dashboard.put("currentMonthSummary", summary);

        return ResponseEntity.ok(dashboard);
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
}
