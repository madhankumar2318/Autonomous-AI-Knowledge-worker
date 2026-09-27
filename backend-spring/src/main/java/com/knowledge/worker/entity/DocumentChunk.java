package com.knowledge.worker.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "document_chunks", indexes = {
        @Index(name = "idx_doc_chunks_upload", columnList = "upload_id"),
        @Index(name = "idx_doc_chunks_page", columnList = "upload_id, page_number")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentChunk {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "upload_id", nullable = false)
    private Long uploadId;

    @Column(name = "chunk_index", nullable = false)
    private int chunkIndex;

    @Builder.Default
    @Column(name = "page_number", nullable = false, columnDefinition = "integer default 1")
    private int pageNumber = 1;

    @Column(name = "content", columnDefinition = "TEXT", nullable = false)
    private String content;

    @Builder.Default
    @Column(name = "token_count", nullable = false, columnDefinition = "integer default 0")
    private int tokenCount = 0;

    @Column(name = "section_heading", length = 500)
    private String sectionHeading;

    @Column(name = "embedding_json", columnDefinition = "TEXT")
    private String embeddingJson;
}
