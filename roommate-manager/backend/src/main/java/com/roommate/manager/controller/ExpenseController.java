package com.roommate.manager.controller;

import com.roommate.manager.entity.*;
import com.roommate.manager.exception.ApiException;
import com.roommate.manager.repository.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api")
public class ExpenseController {

    private final ExpenseRepository expenseRepository;
    private final UserRepository userRepository;
    private final RoomRepository roomRepository;
    private final RoomMemberRepository roomMemberRepository;
    private final ExpenseSplitRepository expenseSplitRepository;

    public ExpenseController(ExpenseRepository expenseRepository,
                            UserRepository userRepository,
                            RoomRepository roomRepository,
                            RoomMemberRepository roomMemberRepository,
                            ExpenseSplitRepository expenseSplitRepository) {
        this.expenseRepository = expenseRepository;
        this.userRepository = userRepository;
        this.roomRepository = roomRepository;
        this.roomMemberRepository = roomMemberRepository;
        this.expenseSplitRepository = expenseSplitRepository;
    }

    @GetMapping("/expenses")
    public ResponseEntity<List<Map<String, Object>>> getExpenses(@RequestParam(required = false) Long roomId) {
        User currentUser = getCurrentUser();
        Room room = getUserRoom(currentUser, roomId);
        List<Expense> expenses = expenseRepository.findByRoomOrderByExpenseDateDesc(room);

        List<Map<String, Object>> result = new ArrayList<>();
        for (Expense expense : expenses) {
            List<ExpenseSplit> splits = expenseSplitRepository.findByExpense(expense);
            Map<String, Object> item = new HashMap<>();
            item.put("id", expense.getId());
            item.put("title", expense.getTitle());
            item.put("category", expense.getCategory());
            item.put("amount", expense.getAmount());
            item.put("expenseDate", expense.getExpenseDate());
            item.put("description", expense.getDescription());
            item.put("paidBy", expense.getPaidBy().getFullName());
            item.put("splits", splits.stream().map(split -> {
                Map<String, Object> s = new HashMap<>();
                s.put("user", split.getUser().getFullName());
                s.put("shareAmount", split.getShareAmount());
                s.put("paidAmount", split.getPaidAmount());
                s.put("status", split.getStatus());
                return s;
            }).toList());
            result.add(item);
        }

        return ResponseEntity.ok(result);
    }

    @PostMapping("/expenses")
    public ResponseEntity<?> createExpense(@Valid @RequestBody Map<String, Object> request) {
        User currentUser = getCurrentUser();
        Long roomId = Long.valueOf(request.get("roomId").toString());
        Room room = roomRepository.findById(roomId)
            .orElseThrow(() -> new ApiException("Room not found."));

        if (!room.getCreatedBy().getId().equals(currentUser.getId())) {
            throw new ApiException("You are not authorized to add expense for this room.");
        }

        String title = (String) request.get("title");
        String category = (String) request.get("category");
        String description = (String) request.get("description");
        BigDecimal amount = new BigDecimal(request.get("amount").toString());
        LocalDate expenseDate = LocalDate.parse(request.get("expenseDate").toString());

        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ApiException("Expense amount must be greater than zero.");
        }

        List<RoomMember> members = roomMemberRepository.findByRoom(room);
        if (members.isEmpty()) {
            throw new ApiException("Add at least one room member before creating expense.");
        }

        Expense expense = new Expense();
        expense.setRoom(room);
        expense.setTitle(title);
        expense.setCategory(category);
        expense.setAmount(amount);
        expense.setExpenseDate(expenseDate);
        expense.setPaidBy(currentUser);
        expense.setDescription(description);
        Expense savedExpense = expenseRepository.save(expense);

        BigDecimal share = amount.divide(BigDecimal.valueOf(members.size()), 2, RoundingMode.HALF_UP);

        for (RoomMember member : members) {
            ExpenseSplit split = new ExpenseSplit();
            split.setExpense(savedExpense);
            split.setUser(member.getUser());
            split.setShareAmount(share);
            split.setPaidAmount(BigDecimal.ZERO);
            split.setStatus("PENDING");
            expenseSplitRepository.save(split);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Expense added successfully.");
        response.put("expense", savedExpense);
        response.put("sharePerMember", share);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/expenses/{expenseId}")
    public ResponseEntity<Map<String, String>> updateExpense(@PathVariable Long expenseId, @RequestBody Map<String, Object> request) {
        User currentUser = getCurrentUser();
        Expense expense = expenseRepository.findById(expenseId)
            .orElseThrow(() -> new ApiException("Expense not found."));

        if (!expense.getRoom().getCreatedBy().getId().equals(currentUser.getId())) {
            throw new ApiException("You are not authorized to update this expense.");
        }

        if (request.containsKey("title") && request.get("title") != null) {
            expense.setTitle(request.get("title").toString());
        }
        if (request.containsKey("category") && request.get("category") != null) {
            expense.setCategory(request.get("category").toString());
        }
        if (request.containsKey("amount") && request.get("amount") != null) {
            expense.setAmount(new BigDecimal(request.get("amount").toString()));
        }
        if (request.containsKey("description") && request.get("description") != null) {
            expense.setDescription(request.get("description").toString());
        }

        expenseRepository.save(expense);
        Map<String, String> response = new HashMap<>();
        response.put("message", "Expense updated successfully.");
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/expenses/{expenseId}")
    public ResponseEntity<Map<String, String>> deleteExpense(@PathVariable Long expenseId) {
        User currentUser = getCurrentUser();
        Expense expense = expenseRepository.findById(expenseId)
            .orElseThrow(() -> new ApiException("Expense not found."));

        if (!expense.getRoom().getCreatedBy().getId().equals(currentUser.getId())) {
            throw new ApiException("You are not authorized to delete this expense.");
        }

        expenseRepository.delete(expense);
        Map<String, String> response = new HashMap<>();
        response.put("message", "Expense deleted successfully.");
        return ResponseEntity.ok(response);
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
