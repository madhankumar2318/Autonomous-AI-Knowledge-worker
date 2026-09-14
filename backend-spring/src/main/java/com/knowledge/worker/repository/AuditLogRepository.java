package com.knowledge.worker.repository;

import com.knowledge.worker.entity.AuditLog;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    // Retrieve the most recent log to chain its currentHash as the next prevHash
    Optional<AuditLog> findTop1ByOrderByIdDesc();

    // Query recent audit logs with pagination/limit
    List<AuditLog> findAllByOrderByTimestampDesc(Pageable pageable);

    // Retrieve all logs in ascending chronological order for tamper-verification
    List<AuditLog> findAllByOrderByIdAsc();

    // Metrics & Counts
    long countByTimestampAfter(Instant since);

    long countByStatusAndTimestampAfter(String status, Instant since);

    long countByEventTypeAndTimestampAfter(String eventType, Instant since);
}
