package com.bloomderma.api.service;

import com.bloomderma.api.model.Doctor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Clinic charges used for patient self-booking (never taken from the browser). Change in application.properties. */
@Component
public class FeeConfig {
    private final int inClinic;
    private final int videoDefault;

    public FeeConfig(@Value("${bloomderma.fees.in-clinic:1000}") int inClinic,
                     @Value("${bloomderma.fees.video-default:500}") int videoDefault) {
        this.inClinic = inClinic; this.videoDefault = videoDefault;
    }
    public int inClinic() { return inClinic; }
    public int video(Doctor d) { return d.getVideoFee() == null ? videoDefault : d.getVideoFee(); }
}
