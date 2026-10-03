package com.knowledge.worker.repository;

import com.knowledge.worker.entity.History;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HistoryRepository extends JpaRepository<History, Long> {
    List<History> findByUsernameOrderByTimestampDesc(String username);
}
