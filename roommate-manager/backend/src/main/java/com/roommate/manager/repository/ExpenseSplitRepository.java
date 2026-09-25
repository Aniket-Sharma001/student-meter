package com.roommate.manager.repository;

import com.roommate.manager.entity.Expense;
import com.roommate.manager.entity.ExpenseSplit;
import com.roommate.manager.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExpenseSplitRepository extends JpaRepository<ExpenseSplit, Long> {
    List<ExpenseSplit> findByExpense(Expense expense);
    List<ExpenseSplit> findByUser(User user);
}
