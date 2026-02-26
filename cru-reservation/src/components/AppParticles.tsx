import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

function AdaptiveParticles() {
    const pointsRef = useRef<THREE.Points>(null!);
    const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));

    // Watch for theme changes
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDark(document.documentElement.classList.contains('dark'));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const count = 2000; // เบาลงเพื่อหน้าใช้งานจริง
    const positions = useMemo(() => {
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 10;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 5;
        }
        return pos;
    }, []);

    useFrame((_, delta) => {
        if (pointsRef.current) {
            // เคลื่อนไหวลอยขึ้นช้าๆ เหมือนฝุ่นในแสงแดด
            pointsRef.current.position.y += delta * 0.05;
            if (pointsRef.current.position.y > 0.5) pointsRef.current.position.y = -0.5;

            // หมุนเบาๆ
            pointsRef.current.rotation.y += delta * 0.02;
        }
    });

    return (
        <Points ref={pointsRef} positions={positions} stride={3} frustumCulled={false}>
            <PointMaterial
                transparent
                // เปลี่ยนสีตามโหมด: Dark = ขาว/ฟ้าจาง, Light = เทา/น้ำเงินจาง
                color={isDark ? "#94a3b8" : "#cbd5e1"}
                size={isDark ? 0.015 : 0.012}
                sizeAttenuation={true}
                depthWrite={false}
                blending={isDark ? THREE.AdditiveBlending : THREE.NormalBlending}
                opacity={isDark ? 0.3 : 0.2} // บางมากเพื่อให้ไม่กวนสายตา
            />
        </Points>
    );
}

const AppParticles = () => {
    return (
        <div className="fixed inset-0 -z-10 pointer-events-none transition-colors duration-500 bg-white dark:bg-slate-950">
            <Canvas camera={{ position: [0, 0, 2], fov: 75 }}>
                <AdaptiveParticles />
            </Canvas>
            {/* Overlay สำหรับโหมดมืดเพื่อให้มีความลึก */}
            <div className="absolute inset-0 dark:bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.3)_100%)] pointer-events-none" />
        </div>
    );
};

export default AppParticles;
