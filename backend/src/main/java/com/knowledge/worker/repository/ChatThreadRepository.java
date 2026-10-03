package com.knowledge.worker.repository;

import com.knowledge.worker.entity.ChatThread;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatThreadRepository extends JpaRepository<ChatThread, String> {
    List<ChatThread> findByUsernameOrderByUpdatedAtDesc(String username);
}
