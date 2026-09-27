package com.knowledge.worker.repository;

import com.knowledge.worker.entity.DocumentChunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;

@Repository
public interface DocumentChunkRepository extends JpaRepository<DocumentChunk, Long> {

    List<DocumentChunk> findByUploadIdOrderByChunkIndexAsc(Long uploadId);

    List<DocumentChunk> findByUploadIdInOrderByUploadIdAscChunkIndexAsc(Collection<Long> uploadIds);

    long countByUploadId(Long uploadId);

    boolean existsByUploadId(Long uploadId);

    @Modifying
    @Transactional
    @Query("DELETE FROM DocumentChunk c WHERE c.uploadId = :uploadId")
    void deleteByUploadId(Long uploadId);
}
