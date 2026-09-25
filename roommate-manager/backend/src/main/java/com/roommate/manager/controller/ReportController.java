package com.roommate.manager.controller;

import com.roommate.manager.entity.*;
import com.roommate.manager.exception.ApiException;
import com.roommate.manager.repository.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ReportController {

    private final UserRepository userRepository;
    private final RoomRepository roomRepository;
    private final ExpenseRepository expenseRepository;
    private final PaymentRepository paymentRepository;

    public ReportController(UserRepository userRepository,
                           RoomRepository roomRepository,
                           ExpenseRepository expenseRepository,
                           PaymentRepository paymentRepository) {
        this.userRepository = userRepository;
        this.roomRepository = roomRepository;
        this.expenseRepository = expenseRepository;
        this.paymentRepository = paymentRepository;
    }

    @GetMapping("/reports/monthly")
    public ResponseEntity<Map<String, Object>> getMonthlyReport(@RequestParam(required = false) Long roomId) {
        User currentUser = getCurrentUser();
        Room room = getUserRoom(currentUser, roomId);

        List<Expense> expenses = expenseRepository.findByRoomOrderByExpenseDateDesc(room);
        List<com.roommate.manager.entity.Payment> payments = paymentRepository.findByRoomOrderByPaymentDateDesc(room);

        BigDecimal totalRent = room.getMonthlyRent();
        BigDecimal totalElectricity = expenses.stream()
            .filter(e -> "Electricity".equalsIgnoreCase(e.getCategory()))
            .map(Expense::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalGroceries = expenses.stream()
            .filter(e -> "Grocery".equalsIgnoreCase(e.getCategory()))
            .map(Expense::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalFood = expenses.stream()
            .filter(e -> "Food".equalsIgnoreCase(e.getCategory()))
            .map(Expense::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalOther = expenses.stream()
            .filter(e -> !"Grocery".equalsIgnoreCase(e.getCategory())
                && !"Electricity".equalsIgnoreCase(e.getCategory())
                && !"Food".equalsIgnoreCase(e.getCategory()))
            .map(Expense::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalMonthlyExpense = expenses.stream()
            .map(Expense::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> result = new HashMap<>();
        result.put("roomName", room.getRoomName());
        result.put("totalRent", totalRent);
        result.put("totalElectricity", totalElectricity);
        result.put("totalGroceries", totalGroceries);
        result.put("totalFoodExpenses", totalFood);
        result.put("totalOtherExpenses", totalOther);
        result.put("totalMonthlyExpense", totalMonthlyExpense);
        result.put("numberOfTransactions", payments.size());

        List<Map<String, Object>> categoryBreakdown = new ArrayList<>();
        categoryBreakdown.add(Map.of("category", "Rent", "amount", totalRent));
        categoryBreakdown.add(Map.of("category", "Electricity", "amount", totalElectricity));
        categoryBreakdown.add(Map.of("category", "Grocery", "amount", totalGroceries));
        categoryBreakdown.add(Map.of("category", "Food", "amount", totalFood));
        categoryBreakdown.add(Map.of("category", "Other", "amount", totalOther));
        result.put("categoryBreakdown", categoryBreakdown);

        return ResponseEntity.ok(result);
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
