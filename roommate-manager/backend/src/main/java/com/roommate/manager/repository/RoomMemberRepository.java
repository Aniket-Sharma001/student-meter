package com.roommate.manager.repository;

import com.roommate.manager.entity.Room;
import com.roommate.manager.entity.RoomMember;
import com.roommate.manager.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomMemberRepository extends JpaRepository<RoomMember, Long> {
    List<RoomMember> findByRoom(Room room);
    Optional<RoomMember> findByRoomAndUser(Room room, User user);
    List<RoomMember> findByUser(User user);
}
