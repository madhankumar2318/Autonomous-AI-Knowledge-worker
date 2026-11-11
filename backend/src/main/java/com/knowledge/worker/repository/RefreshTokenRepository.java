package com.knowledge.worker.repository;

import com.knowledge.worker.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    Optional<RefreshToken> findByToken(String token);
    void deleteByUsername(String username);
    void deleteByToken(String token);
    void deleteByFamilyId(String familyId);
    java.util.List<RefreshToken> findAllByFamilyId(String familyId);
    java.util.List<RefreshToken> findByUsername(String username);
    void deleteByUsernameAndFamilyIdNot(String username, String familyId);
    void deleteByIdAndUsername(Long id, String username);
}
