package com.bloomderma.api.controller;

import com.bloomderma.api.dto.SignalRequest;
import com.bloomderma.api.service.VideoService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Signalling for the browser-to-browser video call (PATIENT and DOCTOR of that consultation only). */
@RestController @RequestMapping("/api/video/{appointmentId}")
public class VideoController {
    private final VideoService video;
    public VideoController(VideoService video) { this.video = video; }

    @PostMapping("/join") public Map<String, Object> join(@PathVariable Long appointmentId, Authentication auth) {
        return video.join(appointmentId, auth);
    }
    @PostMapping("/signal") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void send(@PathVariable Long appointmentId, @Valid @RequestBody SignalRequest r, Authentication auth) {
        video.send(appointmentId, r.type(), r.payload(), auth);
    }
    @GetMapping("/signal") public Map<String, Object> poll(@PathVariable Long appointmentId, @RequestParam(defaultValue = "0") long since, Authentication auth) {
        return video.poll(appointmentId, since, auth);
    }
}
