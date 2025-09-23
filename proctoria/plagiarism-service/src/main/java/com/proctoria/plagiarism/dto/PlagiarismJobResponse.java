package com.proctoria.plagiarism.dto;

import java.util.UUID;
import java.time.LocalDateTime;

public class PlagiarismJobResponse {
    private UUID jobId;
    private String status;
    private LocalDateTime createdAt;
    private String message;
    
    public PlagiarismJobResponse() {}
    
    public PlagiarismJobResponse(UUID jobId, String status, LocalDateTime createdAt, String message) {
        this.jobId = jobId;
        this.status = status;
        this.createdAt = createdAt;
        this.message = message;
    }
    
    public UUID getJobId() { return jobId; }
    public void setJobId(UUID jobId) { this.jobId = jobId; }
    
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}