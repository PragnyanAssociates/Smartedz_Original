import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { MdEventAvailable, MdHistory, MdAddCircle } from 'react-icons/md';

export default function AcademicYearSettings() {
    const [years, setYears] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newYear, setNewYear] = useState({ name: '', start: '', end: '' });

    const fetchYears = async () => {
        try {
            setLoading(true);
            const res = await apiClient.get('/academic-years');
            setYears(res.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchYears(); }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            await apiClient.post('/academic-years', { 
                year_name: newYear.name, 
                start_date: newYear.start, 
                end_date: newYear.end 
            });
            alert("New Academic Year Created Successfully!");
            setNewYear({ name: '', start: '', end: '' });
            fetchYears();
        } catch (e) { alert("Failed to add year"); }
    };

    const setCurrentYear = async (id) => {
        if (window.confirm("Changing the current year will move the whole system context to this year. Continue?")) {
            try {
                await apiClient.put(`/academic-years/set-current/${id}`);
                fetchYears();
                // Refresh the whole page to reset global context
                window.location.reload();
            } catch (e) { alert("Update failed"); }
        }
    };

    return (
        <div className="ay-container">
            <style>{`
                .ay-container { padding: 20px; font-family: 'Inter', sans-serif; }
                .setup-card { background: white; padding: 30px; border-radius: 20px; border: 1px solid #e2e8f0; margin-bottom: 30px; }
                .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px; }
                .input-box { display: flex; flex-direction: column; gap: 5px; }
                .input-box label { font-size: 12px; font-weight: 700; color: #64748b; }
                .input-box input { padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; outline: none; }
                .add-ay-btn { background: #4f46e5; color: white; border: none; padding: 12px; border-radius: 10px; font-weight: 700; cursor: pointer; align-self: flex-end; }
                
                .year-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
                .year-card { background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; position: relative; transition: 0.3s; }
                .year-card.active { border-color: #4f46e5; background: #f5f3ff; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.1); }
                .status-badge { position: absolute; top: 15px; right: 15px; padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: 800; }
            `}</style>

            <div className="setup-card">
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    <MdAddCircle size={24} color="#4f46e5" />
                    <h2 style={{margin:0}}>Setup New Session</h2>
                </div>
                <form className="form-row" onSubmit={handleAdd}>
                    <div className="input-box">
                        <label>Session Name</label>
                        <input required placeholder="e.g. 2025-2026" value={newYear.name} onChange={e => setNewYear({...newYear, name: e.target.value})} />
                    </div>
                    <div className="input-box">
                        <label>Start Date</label>
                        <input required type="date" value={newYear.start} onChange={e => setNewYear({...newYear, start: e.target.value})} />
                    </div>
                    <div className="input-box">
                        <label>End Date</label>
                        <input required type="date" value={newYear.end} onChange={e => setNewYear({...newYear, end: e.target.value})} />
                    </div>
                    <button type="submit" className="add-ay-btn">Initialize Year</button>
                </form>
            </div>

            <h3 style={{color: '#1e293b', marginBottom: '20px'}}>Historical & Active Sessions</h3>
            <div className="year-grid">
                {years.map(y => (
                    <div key={y.id} className={`year-card ${y.is_current ? 'active' : ''}`}>
                        <span className="status-badge" style={{
                            background: y.is_current ? '#4f46e5' : '#e2e8f0',
                            color: y.is_current ? 'white' : '#64748b'
                        }}>
                            {y.is_current ? 'CURRENT SESSION' : 'ARCHIVED'}
                        </span>
                        <h4 style={{margin: '0 0 10px 0', fontSize: '20px'}}>{y.year_name}</h4>
                        <div style={{display:'flex', gap:'10px', color:'#64748b', fontSize:'13px'}}>
                            <span>📅 {new Date(y.start_date).toLocaleDateString()}</span>
                            <span>to</span>
                            <span>{new Date(y.end_date).toLocaleDateString()}</span>
                        </div>
                        {!y.is_current && (
                            <button 
                                onClick={() => setCurrentYear(y.id)}
                                style={{marginTop: '20px', width: '100%', padding: '10px', background: 'white', border: '1px solid #4f46e5', color: '#4f46e5', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'}}
                            >
                                Activate This Session
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}