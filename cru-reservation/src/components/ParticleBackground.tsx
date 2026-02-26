import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

function Nebula() {
    const pointsRef = useRef<THREE.Points>(null!);
    const mouse = useRef(new THREE.Vector2(0, 0));

    const count = 4000;

    const [positions, colors] = useMemo(() => {
        const pos = new Float32Array(count * 3);
        const cols = new Float32Array(count * 3);

        // โทนสีอวกาศที่ดูพรีเมียม
        const colorOptions = [
            new THREE.Color("#60a5fa"), // Blue
            new THREE.Color("#c084fc"), // Purple
            new THREE.Color("#ffffff"), // White
            new THREE.Color("#22d3ee"), // Cyan
        ];

        for (let i = 0; i < count; i++) {
            // กระจายตัวแบบสุ่มให้เต็มพื้นที่กล่อง 3D ขนาดใหญ่ (ไม่กระจุกตรงกลาง)
            // ใช้ช่วงที่กว้างขึ้นเพื่อให้ดาวกระจายไปทั่วขอบจอ
            pos[i * 3] = (Math.random() - 0.5) * 15;     // X: -7.5 ถึง 7.5
            pos[i * 3 + 1] = (Math.random() - 0.5) * 15; // Y: -7.5 ถึง 7.5
            pos[i * 3 + 2] = (Math.random() - 0.5) * 10; // Z: -5 ถึง 5

            const chosenColor = colorOptions[Math.floor(Math.random() * colorOptions.length)];
            cols[i * 3] = chosenColor.r;
            cols[i * 3 + 1] = chosenColor.g;
            cols[i * 3 + 2] = chosenColor.b;
        }
        return [pos, cols];
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    useFrame((_, delta) => {
        if (pointsRef.current) {
            // หมุนช้าๆ ให้ดูเหมือนอวกาศโอบล้อมตัวเรา
            pointsRef.current.rotation.y += delta * 0.03;

            // เอียงตามเมาส์แบบเบาๆ เพื่อให้ดูมีมิติ
            pointsRef.current.rotation.x = THREE.MathUtils.lerp(pointsRef.current.rotation.x, -mouse.current.y * 0.2, 0.05);
            pointsRef.current.rotation.y = THREE.MathUtils.lerp(pointsRef.current.rotation.y, mouse.current.x * 0.2, 0.05);
        }
    });

    return (
        <Points ref={pointsRef} positions={positions} colors={colors} stride={3} frustumCulled={false}>
            <PointMaterial
                transparent
                vertexColors
                size={0.02}
                sizeAttenuation={true}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                opacity={0.6}
            />
        </Points>
    );
}

const ParticleBackground = () => {
    return (
        <div className="fixed inset-0 -z-10 bg-[#020617]">
            <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
                <color attach="background" args={['#020617']} />
                <Nebula />
            </Canvas>
            {/* ปรับ Gradient ให้ดูฟุ้งกระจาย ไม่กระจุก */}
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/10 via-transparent to-purple-900/10 pointer-events-none" />
        </div>
    );
};

export default ParticleBackground;
