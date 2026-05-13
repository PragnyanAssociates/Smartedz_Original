import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { MdLayers, MdAdd, MdDeleteSweep, MdCheckCircle } from 'react-icons/md';

export default function ClassSettings() {
    const [className, setClassName] = useState('');
    const [sectionInput, setSectionInput] = useState(''); // e.g. "A, B, C"
    const [classList, setClassList] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchStructure = async () => {
        setLoading(true);
        try {
            // This endpoint returns classes and their joined sections
            const res = await apiClient.get('/classes');
            // We'll also need a way to get sections per class
            const data = res.data;
            setClassList(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchStructure(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        const sections = sectionInput.split(',').map(s => s.trim()).filter(s => s !== "");
        try {
            await apiClient.post('/classes', { class_name: className, sections });
            alert("Class and Sections initialized successfully!");
            setClassName('');
            setSectionInput('');
            fetchStructure();
        } catch (e) { alert("Error creating class structure"); }
    };

    return (
        <div className="class-settings">
            <style>{`
                .class-settings { padding: 10px; font-family: 'Inter', sans-serif; }
                .config-grid { display: grid; grid-template-columns: 1fr 1.5fr; gap: 30px; }
                
                .setup-card { background: white; padding: 30px; border-radius: 20px; border: 1px solid #e2e8f0; height: fit-content; position: sticky; top: 20px; }
                .setup-card h2 { margin: 0 0 10px 0; font-size: 20px; color: #1e293b; }
                
                .form-group { margin-bottom: 20px; }
                .form-group label { display: block; font-size: 13px; font-weight: 700; color: #64748b; margin-bottom: 8px; }
                .form-group input { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; outline: none; box-sizing: border-box; }
                .form-group input:focus { border-color: #4f46e5; }
                
                .save-btn { width: 100%; background: #4f46e5; color: white; padding: 14px; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: 0.3s; }
                .save-btn:hover { background: #4338ca; }

                .list-card { background: white; padding: 30px; border-radius: 20px; border: 1px solid #e2e8f0; }
                .class-item { 
                    padding: 20px; border: 1px solid #f1f5f9; border-radius: 15px; margin-bottom: 15px;
                    display: flex; justify-content: space-between; align-items: center; transition: 0.3s;
                }
                .class-item:hover { border-color: #dbeafe; background: #f8fafc; }
                .section-badge { 
                    display: inline-block; background: #eff6ff; color: #1d4ed8; 
                    padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; margin-right: 8px;
                    border: 1px solid #dbeafe;
                }
                
                @media (max-width: 1000px) { .config-grid { grid-template-columns: 1fr; } }
            `}</style>

            <div className="config-grid">
                {/* 1. SETUP FORM */}
                <div className="setup-card">
                    <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'20px'}}>
                        <MdLayers size={28} color="#4f46e5" />
                        <h2>Define Class Structure</h2>
                    </div>
                    <form onSubmit={handleCreate}>
                        <div className="form-group">
                            <label>Class Name</label>
                            <input required placeholder="e.g. Class 10" value={className} onChange={e => setClassName(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Sections (Comma Separated)</label>
                            <input placeholder="e.g. A, B, C" value={sectionInput} onChange={e => setSectionInput(e.target.value)} />
                            <p style={{fontSize:'11px', color:'#94a3b8', mt:'5px'}}>Leave empty if the class has no sections.</p>
                        </div>
                        <button type="submit" className="save-btn">Initialize Class</button>
                    </form>
                </div>

                {/* 2. LIST AREA */}
                <div className="list-card">
                    <h3>Active Classes & Sections</h3>
                    <p style={{color:'#64748b', fontSize:'14px', marginBottom:'30px'}}>This represents your school's current academic organization.</p>
                    
                    {classList.length > 0 ? classList.map(c => (
                        <div key={c.id} className="class-item">
                            <div>
                                <h4 style={{margin:0, fontSize:'18px', color:'#1e293b'}}>{c.class_name}</h4>
                                <div style={{marginTop:'10px'}}>
                                    <span className="section-badge">Main Body</span>
                                    {/* Backend needs to provide sections array for this to map correctly */}
                                    <span style={{fontSize:'12px', color:'#94a3b8'}}>Dynamic sections link coming soon...</span>
                                </div>
                            </div>
                            <button style={{background:'none', border:'none', color:'#fda4af', cursor:'pointer'}}><MdDeleteSweep size={24}/></button>
                        </div>
                    )) : (
                        <div style={{textAlign:'center', padding:'50px', color:'#94a3b8'}}>No classes defined yet.</div>
                    )}
                </div>
            </div>
        </div>
    );
}