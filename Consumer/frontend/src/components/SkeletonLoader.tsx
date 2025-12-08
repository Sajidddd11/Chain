export function SkeletonCard() {
    return (
        <div className="skeleton-card">
            <div className="skeleton-header">
                <div className="skeleton-circle"></div>
                <div className="skeleton-text-block">
                    <div className="skeleton-text skeleton-text-title"></div>
                    <div className="skeleton-text skeleton-text-subtitle"></div>
                </div>
            </div>
            <div className="skeleton-content">
                <div className="skeleton-text skeleton-text-full"></div>
                <div className="skeleton-text skeleton-text-medium"></div>
                <div className="skeleton-text skeleton-text-small"></div>
            </div>
            <style>{`
                @keyframes shimmer {
                    0% {
                        background-position: -1000px 0;
                    }
                    100% {
                        background-position: 1000px 0;
                    }
                }

                .skeleton-card {
                    background: white;
                    border-radius: 12px;
                    padding: 1.5rem;
                    border: 1px solid #e2e8f0;
                    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }

                .skeleton-header {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .skeleton-circle {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    background: linear-gradient(
                        90deg,
                        #f0f0f0 0%,
                        #e0e0e0 50%,
                        #f0f0f0 100%
                    );
                    background-size: 1000px 100%;
                    animation: shimmer 2s infinite linear;
                }

                .skeleton-text-block {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .skeleton-text {
                    height: 12px;
                    border-radius: 6px;
                    background: linear-gradient(
                        90deg,
                        #f0f0f0 0%,
                        #e0e0e0 50%,
                        #f0f0f0 100%
                    );
                    background-size: 1000px 100%;
                    animation: shimmer 2s infinite linear;
                }

                .skeleton-text-title {
                    height: 16px;
                    width: 60%;
                }

                .skeleton-text-subtitle {
                    height: 12px;
                    width: 40%;
                }

                .skeleton-content {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .skeleton-text-full {
                    width: 100%;
                }

                .skeleton-text-medium {
                    width: 80%;
                }

                .skeleton-text-small {
                    width: 60%;
                }

                @keyframes pulse {
                    0%, 100% {
                        opacity: 1;
                    }
                    50% {
                        opacity: 0.8;
                    }
                }
            `}</style>
        </div>
    );
}

export function SkeletonGrid({ count = 3 }: { count?: number }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {Array.from({ length: count }).map((_, index) => (
                <SkeletonCard key={index} />
            ))}
        </div>
    );
}
