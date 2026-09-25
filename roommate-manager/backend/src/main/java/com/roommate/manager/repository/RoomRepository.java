package com.roommate.manager.repository;

import com.roommate.manager.entity.Room;
import com.roommate.manager.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {
    List<Room> findByCreatedBy(User createdBy);
}
