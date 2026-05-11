import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { X, Camera } from 'lucide-react';
import { demoStore } from '../services/demoStore';

export default function EventGallery() {
  const photos = demoStore.list('gallery');
  const [open, setOpen] = useState(null);

  return (
    <div className="space-y-5" data-testid="event-gallery">
      <NavLink to=".." className="label-eyebrow text-primary">← Back</NavLink>
      <h1 className="font-display font-black text-3xl tracking-tighter uppercase">Event Gallery</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {photos.map((p, i) => (
          <motion.button
            key={p.id}
            onClick={() => setOpen(p)}
            data-testid={`gallery-${p.id}`}
            whileHover={{ scale: 1.02 }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="group relative aspect-[4/3] rounded-[1.75rem] overflow-hidden bg-muted"
          >
            <img src={p.photoURL} alt={p.eventName} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
              <div className="text-white">
                <div className="label-eyebrow text-white/70">{p.eventName}</div>
                <div className="font-display font-black text-lg tracking-tighter">{p.caption}</div>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur grid place-items-center p-4"
            onClick={() => setOpen(null)}
            data-testid="gallery-lightbox"
          >
            <button onClick={() => setOpen(null)} className="absolute top-4 right-4 p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white" data-testid="lightbox-close">
              <X className="h-5 w-5" />
            </button>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} onClick={(e) => e.stopPropagation()} className="max-w-5xl w-full">
              <img src={open.photoURL} alt={open.eventName} className="w-full rounded-[2rem] object-contain max-h-[80vh]" />
              <div className="mt-4 flex items-center gap-3 text-white">
                <Camera className="h-4 w-4" />
                <div>
                  <div className="label-eyebrow text-white/60">{open.eventName}</div>
                  <div className="font-display font-black text-xl tracking-tighter">{open.caption}</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
