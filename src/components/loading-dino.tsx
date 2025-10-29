"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface Obstacle {
    position: number;
    height: number;
    type: 'cactus' | 'bird';
}

interface Cloud {
    position: number;
    yPosition: number;
    speed: number;
}

export function LoadingDino() {
    const [isJumping, setIsJumping] = useState(false);
    const [isDucking, setIsDucking] = useState(false);
    const [obstacles, setObstacles] = useState<Obstacle[]>([
        { position: 100, height: 12, type: 'cactus' }
    ]);
    const [clouds, setClouds] = useState<Cloud[]>([
        { position: 20, yPosition: 20, speed: 0.3 },
        { position: 60, yPosition: 35, speed: 0.2 },
        { position: 90, yPosition: 15, speed: 0.25 }
    ]);
    const [score, setScore] = useState(0);
    const [groundOffset, setGroundOffset] = useState(0);
    const [legFrame, setLegFrame] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [obstacleSpeed, setObstacleSpeed] = useState(2.5);
    const gameContainerRef = useRef<HTMLDivElement>(null);

    // Collision detection function
    const checkCollision = useCallback(() => {
        if (!gameContainerRef.current || obstacles.length === 0) return false;

        const containerWidth = gameContainerRef.current.offsetWidth;
        const containerHeight = 256; // h-64 = 256px

        // Dino horizontal position - left-16 means left: 64px (16 * 4 = 64px based on Tailwind spacing)
        const dinoLeftPx = 64;
        const dinoWidth = 50;
        const dinoRightPx = dinoLeftPx + dinoWidth;

        // Dino vertical position
        // CSS bottom property: bottom: 64px (normal) or 120px (jumping)
        // Y coordinate: 0 = top, containerHeight = bottom
        const dinoBottomFromBottom = isJumping ? 120 : 64;
        const dinoHeight = isDucking ? 35 : 55;
        const dinoBottomPx = containerHeight - dinoBottomFromBottom;
        const dinoTopPx = dinoBottomPx - dinoHeight;

        for (const obstacle of obstacles) {
            // Obstacle uses right percentage, convert to pixel position
            const obstacleRightPercent = obstacle.position;
            const obstacleRightPx = (obstacleRightPercent / 100) * containerWidth;
            const obstacleWidth = obstacle.type === 'cactus' ? 30 : 40;
            const obstacleLeftPx = obstacleRightPx - obstacleWidth;

            // Obstacle vertical position
            // Cactus: bottom: 64px, Bird: bottom: 100px
            const obstacleBottomFromBottom = obstacle.type === 'bird' ? 100 : 64;
            const obstacleHeight = obstacle.type === 'cactus' ? 48 : 25;
            const obstacleBottomPx = containerHeight - obstacleBottomFromBottom;
            const obstacleTopPx = obstacleBottomPx - obstacleHeight;

            // AABB collision detection: check if bounding boxes overlap
            const horizontalOverlap = dinoRightPx > obstacleLeftPx && dinoLeftPx < obstacleRightPx;
            const verticalOverlap = dinoBottomPx > obstacleTopPx && dinoTopPx < obstacleBottomPx;

            if (horizontalOverlap && verticalOverlap) {
                return true;
            }
        }
        return false;
    }, [obstacles, isJumping, isDucking]);

    const handleJump = useCallback(() => {
        if (!isJumping && !isDucking && !gameOver) {
            setIsJumping(true);
            setTimeout(() => setIsJumping(false), 600);
        }
    }, [isJumping, isDucking, gameOver]);

    const handleDuck = useCallback((duck: boolean) => {
        if (!isJumping && !gameOver) {
            setIsDucking(duck);
        }
    }, [isJumping, gameOver]);

    const resetGame = useCallback(() => {
        setGameOver(false);
        setScore(0);
        setObstacles([{ position: 100, height: 12, type: 'cactus' }]);
        setObstacleSpeed(2.5);
        setIsJumping(false);
        setIsDucking(false);
    }, []);

    useEffect(() => {
        if (gameOver) return;

        // Animate obstacles and score
        const interval = setInterval(() => {
            setObstacles((prev) => {
                const updated = prev.map((obs) => ({
                    ...obs,
                    position: obs.position - obstacleSpeed,
                })).filter((obs) => obs.position > -10);

                // Add score when obstacle passes
                updated.forEach((obs) => {
                    if (obs.position < 8 && obs.position > 7) {
                        setScore((s) => {
                            const newScore = s + 1;
                            // Increase speed every 10 points
                            if (newScore % 10 === 0) {
                                setObstacleSpeed((speed) => Math.min(speed + 0.3, 5.5));
                            }
                            return newScore;
                        });
                    }
                });

                return updated;
            });

            // Animate clouds
            setClouds((prev) =>
                prev.map((cloud) => ({
                    ...cloud,
                    position: cloud.position - cloud.speed,
                })).map((cloud) =>
                    cloud.position < -10 ? { ...cloud, position: 110 } : cloud
                )
            );

            // Animate ground
            setGroundOffset((prev) => (prev + obstacleSpeed * 0.8) % 20);

            // Animate legs
            setLegFrame((prev) => (prev + 1) % 4);

            // Check for collisions
            if (checkCollision()) {
                setGameOver(true);
            }
        }, 50);

        // Add new obstacles more frequently (reduced from 2000ms to 1200ms)
        // And adjust frequency based on score to make it progressively harder
        const getObstacleInterval = () => {
            const baseInterval = 1200;
            const scoreMultiplier = Math.max(0.7, 1 - (score / 100) * 0.3); // Gets faster as score increases
            return baseInterval * scoreMultiplier;
        };

        const addObstacle = () => {
            const random = Math.random();
            const obstacleType: 'cactus' | 'bird' = random > 0.7 ? 'bird' : 'cactus';
            const height = obstacleType === 'bird' ? (random > 0.8 ? 20 : 14) : 12;

            setObstacles((prev) => [
                ...prev,
                { position: 110, height, type: obstacleType }
            ]);
        };

        // Start the obstacle generation chain
        let obstacleTimeoutId: NodeJS.Timeout;
        const startObstacleChain = () => {
            const nextInterval = getObstacleInterval();
            obstacleTimeoutId = setTimeout(() => {
                if (!gameOver) {
                    addObstacle();
                    startObstacleChain();
                }
            }, nextInterval);
        };
        startObstacleChain();

        // Handle keyboard
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === "Space" || e.code === "ArrowUp") {
                e.preventDefault();
                if (gameOver) {
                    resetGame();
                } else {
                    handleJump();
                }
            } else if (e.code === "ArrowDown") {
                e.preventDefault();
                handleDuck(true);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === "ArrowDown") {
                e.preventDefault();
                handleDuck(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

        return () => {
            clearInterval(interval);
            if (obstacleTimeoutId) {
                clearTimeout(obstacleTimeoutId);
            }
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, [handleJump, handleDuck, checkCollision, obstacleSpeed, score, gameOver, resetGame]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-black/60 via-black/50 to-black/60 backdrop-blur-md"
            onClick={gameOver ? resetGame : handleJump}
        >
            <div className="relative w-full max-w-3xl mx-auto px-4">
                <div className="bg-gradient-to-br from-white to-gray-50 dark:from-zinc-900 dark:to-zinc-950 rounded-2xl p-8 shadow-2xl border border-gray-200 dark:border-zinc-800">
                    {/* Score and Title */}
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
                                Agents Working...
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                Keep the dino alive while we process your request
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                                {score}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">SCORE</div>
                        </div>
                    </div>

                    {/* Game Container */}
                    <div
                        ref={gameContainerRef}
                        className="relative h-64 bg-gradient-to-b from-sky-100 to-amber-50 dark:from-sky-950 dark:to-zinc-900 rounded-xl overflow-hidden border-2 border-gray-300 dark:border-zinc-700 shadow-inner"
                    >
                        {/* Clouds */}
                        {clouds.map((cloud, index) => (
                            <div
                                key={index}
                                className="absolute"
                                style={{
                                    left: `${cloud.position}%`,
                                    top: `${cloud.yPosition}%`,
                                    transition: 'left 0.05s linear',
                                }}
                            >
                                <svg width="50" height="20" viewBox="0 0 50 20" className="opacity-40 dark:opacity-20">
                                    <ellipse cx="12" cy="12" rx="8" ry="6" fill="currentColor" className="text-gray-400 dark:text-gray-600" />
                                    <ellipse cx="22" cy="10" rx="10" ry="8" fill="currentColor" className="text-gray-400 dark:text-gray-600" />
                                    <ellipse cx="35" cy="12" rx="8" ry="6" fill="currentColor" className="text-gray-400 dark:text-gray-600" />
                                </svg>
                            </div>
                        ))}

                        {/* Ground with pattern */}
                        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-amber-100 to-amber-200 dark:from-amber-950 dark:to-zinc-900">
                            {/* Ground line pattern */}
                            <div
                                className="absolute top-0 left-0 right-0 h-0.5 bg-gray-400 dark:bg-zinc-600"
                                style={{
                                    backgroundImage: 'repeating-linear-gradient(to right, currentColor 0, currentColor 10px, transparent 10px, transparent 20px)',
                                    transform: `translateX(-${groundOffset}px)`,
                                }}
                            ></div>
                        </div>

                        {/* Dino */}
                        <div
                            className={`absolute left-16 transition-all ${isJumping ? 'duration-300 ease-out' : 'duration-200 ease-in'
                                }`}
                            style={{
                                bottom: isJumping ? '120px' : '64px',
                                width: "50px",
                                height: isDucking ? "35px" : "55px",
                                transition: isJumping
                                    ? 'bottom 0.3s cubic-bezier(0.33, 1, 0.68, 1), height 0.1s ease'
                                    : 'bottom 0.2s cubic-bezier(0.6, -0.28, 0.74, 0.05), height 0.1s ease',
                            }}
                        >
                            <svg
                                viewBox={isDucking ? "0 20 50 30" : "0 0 50 55"}
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-full h-full drop-shadow-lg"
                            >
                                {!isDucking ? (
                                    <>
                                        {/* Head */}
                                        <rect x="8" y="5" width="20" height="18" fill="currentColor" className="text-green-600 dark:text-green-500" rx="2" />
                                        <rect x="25" y="10" width="8" height="8" fill="currentColor" className="text-green-600 dark:text-green-500" />

                                        {/* Eye */}
                                        <circle cx="18" cy="13" r="3" fill="currentColor" className="text-white" />
                                        <circle cx="18" cy="13" r="1.5" fill="currentColor" className="text-gray-900" />

                                        {/* Body */}
                                        <rect x="10" y="23" width="25" height="20" fill="currentColor" className="text-green-600 dark:text-green-500" rx="2" />

                                        {/* Arms */}
                                        <rect x="7" y="28" width="5" height="8" fill="currentColor" className="text-green-700 dark:text-green-600" rx="1" />
                                        <rect x="33" y="28" width="5" height="8" fill="currentColor" className="text-green-700 dark:text-green-600" rx="1" />

                                        {/* Legs with animation */}
                                        <rect
                                            x={legFrame < 2 ? "15" : "17"}
                                            y="43"
                                            width="7"
                                            height="12"
                                            fill="currentColor"
                                            className="text-green-700 dark:text-green-600"
                                            rx="1"
                                        />
                                        <rect
                                            x={legFrame < 2 ? "26" : "24"}
                                            y="43"
                                            width="7"
                                            height="12"
                                            fill="currentColor"
                                            className="text-green-700 dark:text-green-600"
                                            rx="1"
                                        />

                                        {/* Tail */}
                                        <polygon points="35,30 43,28 43,35 35,35" fill="currentColor" className="text-green-700 dark:text-green-600" />
                                    </>
                                ) : (
                                    <>
                                        {/* Ducking pose */}
                                        <rect x="8" y="20" width="35" height="18" fill="currentColor" className="text-green-600 dark:text-green-500" rx="2" />
                                        <rect x="8" y="15" width="15" height="12" fill="currentColor" className="text-green-600 dark:text-green-500" rx="2" />
                                        <circle cx="15" cy="20" r="2" fill="currentColor" className="text-white" />
                                        <circle cx="15" cy="20" r="1" fill="currentColor" className="text-gray-900" />
                                        <polygon points="43,25 48,23 48,28 43,28" fill="currentColor" className="text-green-700 dark:text-green-600" />
                                    </>
                                )}
                            </svg>
                        </div>

                        {/* Obstacles */}
                        {obstacles.map((obstacle, index) => (
                            <div
                                key={index}
                                className="absolute transition-all duration-50"
                                style={{
                                    right: `${obstacle.position}%`,
                                    bottom: obstacle.type === 'bird' ? '100px' : '64px',
                                }}
                            >
                                {obstacle.type === 'cactus' ? (
                                    <svg width="30" height="48" viewBox="0 0 30 48" className="drop-shadow-md">
                                        <rect x="11" y="10" width="8" height="38" fill="currentColor" className="text-green-700 dark:text-green-600" rx="2" />
                                        <rect x="5" y="20" width="8" height="15" fill="currentColor" className="text-green-700 dark:text-green-600" rx="2" />
                                        <rect x="17" y="15" width="8" height="18" fill="currentColor" className="text-green-700 dark:text-green-600" rx="2" />
                                        {/* Spikes */}
                                        <circle cx="15" cy="12" r="2" fill="currentColor" className="text-yellow-500" />
                                        <circle cx="15" cy="22" r="2" fill="currentColor" className="text-yellow-500" />
                                        <circle cx="15" cy="32" r="2" fill="currentColor" className="text-yellow-500" />
                                    </svg>
                                ) : (
                                    <svg width="40" height="25" viewBox="0 0 40 25" className="drop-shadow-md animate-bounce" style={{ animationDuration: '0.5s' }}>
                                        {/* Bird */}
                                        <ellipse cx="20" cy="12" rx="15" ry="8" fill="currentColor" className="text-gray-700 dark:text-gray-600" />
                                        <polygon points="5,12 0,10 0,14" fill="currentColor" className="text-gray-700 dark:text-gray-600" />
                                        <polygon points="35,12 40,10 40,14" fill="currentColor" className="text-gray-700 dark:text-gray-600" />
                                        <circle cx="23" cy="10" r="2" fill="currentColor" className="text-white" />
                                        <circle cx="28" cy="12" r="3" fill="currentColor" className="text-orange-500" />
                                    </svg>
                                )}
                            </div>
                        ))}

                        {/* Game Over Overlay */}
                        {gameOver && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-xl">
                                <div className="text-center space-y-4">
                                    <div className="text-4xl font-bold text-white drop-shadow-lg">
                                        Game Over!
                                    </div>
                                    <div className="text-xl text-white/90">
                                        Final Score: <span className="font-bold">{score}</span>
                                    </div>
                                    <div className="text-sm text-white/70 mt-2">
                                        Press SPACE or click to restart
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="mt-6 text-center space-y-3">
                        <div className="flex items-center justify-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-zinc-800 rounded-lg">
                                <kbd className="px-2 py-1 bg-white dark:bg-zinc-700 rounded text-xs font-mono border border-gray-300 dark:border-zinc-600">SPACE</kbd>
                                <span className="text-sm text-gray-600 dark:text-gray-400">Jump</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-zinc-800 rounded-lg">
                                <kbd className="px-2 py-1 bg-white dark:bg-zinc-700 rounded text-xs font-mono border border-gray-300 dark:border-zinc-600">↓</kbd>
                                <span className="text-sm text-gray-600 dark:text-gray-400">Duck</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-zinc-800 rounded-lg">
                                <span className="text-sm text-gray-600 dark:text-gray-400">or click to jump</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-2 pt-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></div>
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }}></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
