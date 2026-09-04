import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react';

export default function ImageCropperModal({ 
  imageSrc, 
  onCropComplete, // function(croppedBlob)
  onCancel,
  aspectRatio = 126 / 152 // Default ID card photo aspect ratio based on IDCardStudio WxH
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropChange = (crop) => {
    setCrop(crop);
  };

  const onCropCompleteHandler = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const onZoomChange = (zoom) => {
    setZoom(zoom);
  };

  const createCroppedImage = async () => {
    try {
      const image = new Image();
      image.src = imageSrc;
      image.crossOrigin = 'anonymous'; // Added to avoid CORS issues
      await new Promise(resolve => { image.onload = resolve; });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;

      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', 0.95);
      });
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const handleSave = async () => {
    const croppedBlob = await createCroppedImage();
    if (croppedBlob) {
      onCropComplete(croppedBlob);
    } else {
      onCancel();
    }
  };

  if (!imageSrc) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6" style={{ isolation: 'isolate' }}>
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
          onClick={onCancel}
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-card w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
            <div>
              <h3 className="font-display font-black text-xl tracking-tighter">Crop Photo</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Adjust the image to fit the ID card photo frame</p>
            </div>
            <button 
              onClick={onCancel}
              className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Cropper Container */}
          <div className="relative w-full h-[50vh] min-h-[300px] bg-black/5">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspectRatio}
              onCropChange={onCropChange}
              onCropComplete={onCropCompleteHandler}
              onZoomChange={onZoomChange}
              objectFit="vertical-cover"
            />
          </div>

          {/* Footer Controls */}
          <div className="px-6 py-5 bg-muted/30 border-t border-border flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div className="flex items-center gap-3 w-full sm:w-64">
              <ZoomOut className="h-4 w-4 text-muted-foreground" />
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => {
                  setZoom(e.target.value)
                }}
                className="flex-1 accent-primary"
              />
              <ZoomIn className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                onClick={onCancel}
                className="flex-1 sm:flex-none h-11 px-5 rounded-xl border border-border bg-card hover:bg-muted font-bold text-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 sm:flex-none h-11 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Check className="h-4 w-4" /> Apply Crop
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
