package com.roommate.manager.controller;

import com.roommate.manager.entity.Room;
import com.roommate.manager.entity.RoomMember;
import com.roommate.manager.entity.User;
import com.roommate.manager.exception.ApiException;
import com.roommate.manager.repository.RoomMemberRepository;
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
public class RoomController {

    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final RoomMemberRepository roomMemberRepository;

    public RoomController(RoomRepository roomRepository,
                         UserRepository userRepository,
                         RoomMemberRepository roomMemberRepository) {
        this.roomRepository = roomRepository;
        this.userRepository = userRepository;
        this.roomMemberRepository = roomMemberRepository;
    }

    @GetMapping("/rooms")
    public ResponseEntity<List<Room>> getRooms() {
        User currentUser = getCurrentUser();
        return ResponseEntity.ok(roomRepository.findByCreatedBy(currentUser));
    }

    @PostMapping("/rooms")
    public ResponseEntity<?> createRoom(@Valid @RequestBody Map<String, Object> request) {
        User currentUser = getCurrentUser();

        String roomName = (String) request.get("roomName");
        String roomAddress = (String) request.get("roomAddress");
        Integer totalMembers = request.get("totalMembers") != null ? Integer.valueOf(request.get("totalMembers").toString()) : 0;
        BigDecimal monthlyRent = request.get("monthlyRent") != null ? new BigDecimal(request.get("monthlyRent").toString()) : BigDecimal.ZERO;

        if (roomName == null || roomName.trim().isEmpty()) {
            throw new ApiException("Room name is required.");
        }

        if (monthlyRent.compareTo(BigDecimal.ZERO) < 0) {
            throw new ApiException("Rent cannot be negative.");
        }

        Room room = new Room();
        room.setRoomName(roomName.trim());
        room.setRoomAddress(roomAddress != null ? roomAddress.trim() : "");
        room.setTotalMembers(totalMembers);
        room.setMonthlyRent(monthlyRent);
        room.setCreatedBy(currentUser);

        Room savedRoom = roomRepository.save(room);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedRoom);
    }

    @PostMapping("/rooms/{roomId}/members")
    public ResponseEntity<?> addMember(@PathVariable Long roomId, @RequestBody Map<String, Object> request) {
        User currentUser = getCurrentUser();
        Room room = roomRepository.findById(roomId)
            .orElseThrow(() -> new ApiException("Room not found."));

        if (!room.getCreatedBy().getId().equals(currentUser.getId())) {
            throw new ApiException("You are not authorized to modify this room.");
        }

        String email = (String) request.get("email");
        if (email == null || email.trim().isEmpty()) {
            throw new ApiException("Member email is required.");
        }

        User memberUser = userRepository.findByEmail(email.trim().toLowerCase())
            .orElseThrow(() -> new ApiException("User with this email not found."));

        if (roomMemberRepository.findByRoomAndUser(room, memberUser).isPresent()) {
            throw new ApiException("This user is already a member of the room.");
        }

        RoomMember member = new RoomMember();
        member.setRoom(room);
        member.setUser(memberUser);
        member.setJoinDate(LocalDate.now());
        member.setTotalPaid(BigDecimal.ZERO);
        member.setPendingAmount(BigDecimal.ZERO);

        RoomMember savedMember = roomMemberRepository.save(member);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedMember);
    }

    @GetMapping("/rooms/{roomId}/members")
    public ResponseEntity<List<RoomMember>> getMembers(@PathVariable Long roomId) {
        User currentUser = getCurrentUser();
        Room room = roomRepository.findById(roomId)
            .orElseThrow(() -> new ApiException("Room not found."));

        if (!room.getCreatedBy().getId().equals(currentUser.getId())) {
            throw new ApiException("Unauthorized access.");
        }

        return ResponseEntity.ok(roomMemberRepository.findByRoom(room));
    }

    @DeleteMapping("/rooms/{roomId}/members/{memberId}")
    public ResponseEntity<Map<String, String>> removeMember(@PathVariable Long roomId, @PathVariable Long memberId) {
        User currentUser = getCurrentUser();
        Room room = roomRepository.findById(roomId)
            .orElseThrow(() -> new ApiException("Room not found."));

        if (!room.getCreatedBy().getId().equals(currentUser.getId())) {
            throw new ApiException("You are not authorized to modify this room.");
        }

        RoomMember member = roomMemberRepository.findById(memberId)
            .orElseThrow(() -> new ApiException("Member not found."));

        roomMemberRepository.delete(member);
        Map<String, String> response = new HashMap<>();
        response.put("message", "Member removed successfully.");
        return ResponseEntity.ok(response);
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
