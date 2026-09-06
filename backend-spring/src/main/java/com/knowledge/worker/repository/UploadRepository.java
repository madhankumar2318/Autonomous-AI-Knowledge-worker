package com.knowledge.worker.repository;

import com.knowledge.worker.entity.Upload;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UploadRepository extends JpaRepository<Upload, Long> {
    List<Upload> findByUserIdOrderByUploadedAtDesc(Long userId);
    List<Upload> findAllByOrderByUploadedAtDesc();
    Optional<Upload> findByFilename(String filename);
    void deleteByFilename(String filename);
}
