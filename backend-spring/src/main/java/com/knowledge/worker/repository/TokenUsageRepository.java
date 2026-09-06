package com.knowledge.worker.repository;

import com.knowledge.worker.entity.TokenUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TokenUsageRepository extends JpaRepository<TokenUsage, Long> {
    List<TokenUsage> findByUsernameOrderByTimestampDesc(String username);
}
