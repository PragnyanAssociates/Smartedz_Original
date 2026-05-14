import React from 'react';
import { FaUserCircle, FaEnvelope, FaPhone, FaIdBadge, FaCalendarDay, FaBuilding } from 'react-icons/fa';

export default function Profile({ user }) {
    // Fallback data in case user props are not passed immediately
    const profileData = user || {
        full_name: "Vidya Sagar",
        username: "sagar",
        role: "SUPER ADMIN",
        email: "vidyasagar@school.edu",
        phone_no: "+91 9394073325",
        status: "active",
        joining_date: "2023-08-15"
    };

    return (
        <div className="profile-container animate-fade">
            <style>{`
                .profile-container {
                    padding: 30px;
                    font-family: 'Inter', sans-serif;
                    background-color: #f8fafc;
                    min-height: 100vh;
                }
                .profile-header {
                    background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
                    border-radius: 20px;
                    padding: 40px;
                    color: white;
                    display: flex;
                    align-items: center;
                    gap: 30px;
                    box-shadow: 0 10px 25px rgba(79, 70, 229, 0.2);
                    margin-bottom: 30px;
                }
                .avatar-circle {
                    width: 100px;
                    height: 100px;
                    background: white;
                    color: #4f46e5;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 40px;
                    font-weight: 800;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                }
                .profile-title h1 {
                    margin: 0;
                    font-size: 28px;
                    font-weight: 700;
                }
                .role-badge {
                    background: rgba(255, 255, 255, 0.2);
                    padding: 6px 12px;
                    border-radius: 50px;
                    font-size: 12px;
                    font-weight: 600;
                    letter-spacing: 1px;
                    display: inline-block;
                    margin-top: 10px;
                    backdrop-filter: blur(4px);
                }
                .details-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                }
                .info-card {
                    background: white;
                    border-radius: 16px;
                    padding: 25px;
                    border: 1px solid #e2e8f0;
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.02);
                    transition: transform 0.2s;
                }
                .info-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 10px 15px rgba(0,0,0,0.05);
                }
                .icon-box {
                    width: 50px;
                    height: 50px;
                    border-radius: 12px;
                    background: #f1f5f9;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #4f46e5;
                    font-size: 20px;
                }
                .info-text h4 {
                    margin: 0 0 5px 0;
                    color: #64748b;
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .info-text p {
                    margin: 0;
                    color: #1e293b;
                    font-size: 16px;
                    font-weight: 600;
                }
                .animate-fade { animation: fadeIn 0.5s ease; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>

            <div className="profile-header">
                <div className="avatar-circle">
                    {profileData.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="profile-title">
                    <h1>{profileData.full_name}</h1>
                    <div className="role-badge">{profileData.role}</div>
                </div>
            </div>

            <h3 style={{color: '#1e293b', marginBottom: '20px', marginLeft: '5px'}}>Account Details</h3>
            
            <div className="details-grid">
                <div className="info-card">
                    <div className="icon-box"><FaIdBadge /></div>
                    <div className="info-text">
                        <h4>Username</h4>
                        <p>{profileData.username}</p>
                    </div>
                </div>

                <div className="info-card">
                    <div className="icon-box"><FaEnvelope /></div>
                    <div className="info-text">
                        <h4>Email Address</h4>
                        <p>{profileData.email || 'Not Provided'}</p>
                    </div>
                </div>

                <div className="info-card">
                    <div className="icon-box"><FaPhone /></div>
                    <div className="info-text">
                        <h4>Contact Number</h4>
                        <p>{profileData.phone_no || 'Not Provided'}</p>
                    </div>
                </div>

                <div className="info-card">
                    <div className="icon-box"><FaUserCircle /></div>
                    <div className="info-text">
                        <h4>Account Status</h4>
                        <p style={{ color: profileData.status === 'active' ? '#166534' : '#991b1b', textTransform: 'capitalize' }}>
                            {profileData.status}
                        </p>
                    </div>
                </div>

                <div className="info-card">
                    <div className="icon-box"><FaCalendarDay /></div>
                    <div className="info-text">
                        <h4>Joining Date</h4>
                        <p>{profileData.joining_date ? new Date(profileData.joining_date).toLocaleDateString() : 'N/A'}</p>
                    </div>
                </div>
                
                <div className="info-card">
                    <div className="icon-box"><FaBuilding /></div>
                    <div className="info-text">
                        <h4>Institution</h4>
                        <p>Vivekananda Public School</p>
                    </div>
                </div>
            </div>
        </div>
    );
}