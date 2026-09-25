package com.roommate.manager.repository;

import com.roommate.manager.entity.Expense;
import com.roommate.manager.entity.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, Long> {
    List<Expense> findByRoomOrderByExpenseDateDesc(Room room);
}
