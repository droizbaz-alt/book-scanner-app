import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";
import { useEffect, useRef } from "react";

const qrcodeRegionId = "html-5-qr-code-full-region";

const Scanner = (props) => {
    const scannerRef = useRef(null);

    useEffect(() => {
        const config = {
            fps: props.fps || 5,
            qrbox: props.mode === 'cover' ? null : { width: 280, height: 150 },
            aspectRatio: props.aspectRatio || 1.777778,
            disableFlip: false,
            rememberLastUsedCamera: true,
            supportedScanTypes: props.mode === 'cover' ? [] : [0]
        };
        
        const verbose = props.verbose || false;

        if (!(props.qrCodeSuccessCallback)) {
            throw "qrCodeSuccessCallback is required callback.";
        }
        
        // If we are in cover mode, we use Html5Qrcode for simple camera access without auto-scanning barcodes
        if (props.mode === 'cover') {
            const html5QrCode = new Html5Qrcode(qrcodeRegionId);
            scannerRef.current = html5QrCode;
            
            html5QrCode.start(
                { facingMode: "environment" }, 
                { fps: 10, qrbox: null },
                () => {}, // ignore success for barcode
                () => {}  // ignore error
            ).catch(err => console.error("Error starting camera", err));

            return () => {
                html5QrCode.stop().catch(err => console.error("Error stopping camera", err));
            };
        } else {
            const html5QrcodeScanner = new Html5QrcodeScanner(qrcodeRegionId, config, verbose);
            html5QrcodeScanner.render(props.qrCodeSuccessCallback, props.qrCodeErrorCallback);
            scannerRef.current = html5QrcodeScanner;
            
            return () => {
                html5QrcodeScanner.clear().catch(error => {
                    console.error("Failed to clear html5QrcodeScanner. ", error);
                });
            };
        }
    }, [props.mode]);

    const handleCapture = async () => {
        if (!scannerRef.current) return;
        
        try {
            let canvas;
            if (props.mode === 'cover') {
                // For Html5Qrcode, we might need a different way to get the frame if not exposed
                // Usually we can just grab from the video element that html5-qrcode creates
                const video = document.querySelector(`#${qrcodeRegionId} video`);
                if (video) {
                    canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    canvas.getContext('2d').drawImage(video, 0, 0);
                }
            }
            
            if (canvas && props.onCapture) {
                props.onCapture(canvas.toDataURL('image/jpeg'));
            }
        } catch (err) {
            console.error("Capture failed", err);
        }
    };

    return (
        <div style={{ position: 'relative' }}>
            <div id={qrcodeRegionId} style={{ width: '100%' }} />
            {props.mode === 'cover' && (
                <button 
                    onClick={handleCapture}
                    className="btn btn-primary"
                    style={{ 
                        position: 'absolute', 
                        bottom: '30px', 
                        left: '50%', 
                        transform: 'translateX(-50%)',
                        zIndex: 10,
                        padding: '16px 32px',
                        borderRadius: '30px',
                        border: '2px solid white',
                        boxShadow: '0 0 20px rgba(99, 102, 241, 0.6), 0 0 0 100vmax rgba(0,0,0,0.3)',
                        fontSize: '1.1rem'
                    }}
                >
                    Identificar Portada
                </button>
            )}
        </div>
    );
};

export default Scanner;
