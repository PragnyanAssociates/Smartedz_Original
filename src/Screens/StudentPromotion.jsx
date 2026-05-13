import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { MdTrendingUp, MdCheckCircle, MdErrorOutline, MdGroups } from 'react-icons/md';

export default function StudentPromotion() {
    const [years, setYears] = useState([]);
    const [classes, setClasses] = useState([]);
    
    // Source (Current) State
    const [sourceYear, setSourceYear] = useState('');
    const [sourceClass, setSourceClass] = useState('');
    const [students, setStudents] = useState([]);
    
    // Target (Future) State
    const [targetYear, setTargetYear] = useState('');
    const [targetClass, setTargetClass] = useState('');
    
    // Selection State
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [isProcessing, setIsSubmitting] = useState(false);

    useEffect(() => {
        const loadMetadata = async () => {
            const [yRes, cRes] = await Promise.all([
                apiClient.get('/academic-years'),
                apiClient.get('/classes')
            ]);
            setYears(yRes.data);
            setClasses(cRes.data);
        };
        loadMetadata();
    }, []);

    const fetchStudents = async () => {
        if (!sourceYear || !sourceClass) return;
        const res = await apiClient.get(`/promotion/students?year_id=${sourceYear}&class_id=${sourceClass}`);
        setStudents(res.data);
        setSelectedStudents([]); // Reset selection
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedStudents(students.map(s => s.id));
        } else {
            setSelectedStudents([]);
        }
    };

    const toggleStudent = (id) => {
        setSelectedStudents(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handlePromote = async () => {
        if (selectedStudents.length === 0) return alert("Select at least one student");
        if (!targetYear || !targetClass) return alert("Select target year and class");
        if (sourceYear === targetYear) return alert("Target year cannot be the same as current year");

        if (window.confirm(`Promote ${selectedStudents.length} students to the next level?`)) {
            setIsSubmitting(true);
            try {
                await apiClient.post('/promotion/execute', {
                    student_ids: selectedStudents,
                    target_year_id: targetYear,
                    target_class_id: targetClass
                });
                alert("Promotion Process Completed!");
                fetchStudents(); // Refresh list
            } catch (e) { alert("Promotion Failed"); }
            finally { setIsSubmitting(false); }
        }
    };

    return (
        <div className="promotion-container">
            <style>{`
                .promotion-container { padding: 10px; font-family: 'Inter', sans-serif; }
                .promo-header { display: flex; align-items: center; gap: 15px; margin-bottom: 25px; }
                
                .grid-split { display: grid; grid-template-columns: 1fr 300px; gap: 20px; }
                .card { background: white; padding: 25px; border-radius: 20px; border: 1px solid #e2e8f0; }
                
                .filter-bar { display: flex; gap: 15px; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9; }
                .select-box { flex: 1; display: flex; flex-direction: column; gap: 5px; }
                .select-box label { font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
                .select-box select { padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; outline: none; }

                .student-list { width: 100%; border-collapse: collapse; }
                .student-list th { text-align: left; padding: 12px; font-size: 13px; color: #64748b; background: #f8fafc; }
                .student-list td { padding: 12px; border-top: 1px solid #f1f5f9; font-size: 14px; }
                
                .target-card { position: sticky; top: 20px; height: fit-content; background: #1e293b; color: white; border: none; }
                .promote-btn { 
                    width: 100%; padding: 15px; border-radius: 12px; border: none; 
                    background: #4f46e5; color: white; font-weight: 800; cursor: pointer;
                    margin-top: 20px; transition: 0.3s;
                }
                .promote-btn:disabled { background: #334155; cursor: not-allowed; }
            `}</style>

            <div className="promo-header">
                <div style={{background:'#4f46e5', padding:'10px', borderRadius:'12px'}}><MdTrendingUp color="white" size={30}/></div>
                <div>
                    <h1 style={{margin:0, fontSize:'24px'}}>Student Promotion Engine</h1>
                    <p style={{margin:0, color:'#64748b', fontSize:'14px'}}>Upgrade student academic levels for the next session.</p>
                </div>
            </div>

            <div className="grid-split">
                {/* LEFT: Student Selection */}
                <div className="card">
                    <div className="filter-bar">
                        <div className="select-box">
                            <label>Current Academic Year</label>
                            <select value={sourceYear} onChange={e => setSourceYear(e.target.value)}>
                                <option value="">Select Year</option>
                                {years.map(y => <option key={y.id} value={y.id}>{y.year_name}</option>)}
                            </select>
                        </div>
                        <div className="select-box">
                            <label>Current Class</label>
                            <select value={sourceClass} onChange={e => setSourceClass(e.target.value)}>
                                <option value="">Select Class</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                            </select>
                        </div>
                        <button onClick={fetchStudents} style={{alignSelf:'flex-end', padding:'10px 20px', borderRadius:'8px', background:'#f1f5f9', border:'1px solid #e2e8f0', fontWeight:'bold', cursor:'pointer'}}>Load Students</button>
                    </div>

                    <table className="student-list">
                        <thead>
                            <tr>
                                <th style={{width:'40px'}}>
                                    <input type="checkbox" onChange={handleSelectAll} checked={selectedStudents.length === students.length && students.length > 0} />
                                </th>
                                <th>Roll No</th>
                                <th>Student Name</th>
                                <th>Username</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.length > 0 ? students.map(s => (
                                <tr key={s.id}>
                                    <td>
                                        <input type="checkbox" checked={selectedStudents.includes(s.id)} onChange={() => toggleStudent(s.id)} />
                                    </td>
                                    <td>{s.roll_no}</td>
                                    <td style={{fontWeight:600}}>{s.full_name}</td>
                                    <td style={{color:'#94a3b8'}}>{s.username}</td>
                                </tr>
                            )) : (
                                <tr><td colSpan="4" style={{textAlign:'center', padding:'50px', color:'#94a3b8'}}>Select Year & Class to view students.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* RIGHT: Target Configuration */}
                <div className="card target-card">
                    <h3 style={{margin:'0 0 20px 0'}}>Promotion Target</h3>
                    
                    <div className="select-box" style={{marginBottom:'15px'}}>
                        <label style={{color:'#94a3b8'}}>Promote To Year</label>
                        <select style={{background:'#334155', color:'white', border:'1px solid #475569'}} value={targetYear} onChange={e => setTargetYear(e.target.value)}>
                            <option value="">Select Target Year</option>
                            {years.map(y => <option key={y.id} value={y.id}>{y.year_name}</option>)}
                        </select>
                    </div>

                    <div className="select-box">
                        <label style={{color:'#94a3b8'}}>Promote To Class</label>
                        <select style={{background:'#334155', color:'white', border:'1px solid #475569'}} value={targetClass} onChange={e => setTargetClass(e.target.value)}>
                            <option value="">Select Target Class</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                        </select>
                    </div>

                    <div style={{marginTop:'30px', padding:'15px', background:'#0f172a', borderRadius:'10px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', fontSize:'13px'}}>
                            <span>Selected:</span>
                            <span style={{fontWeight:'bold', color:'#818cf8'}}>{selectedStudents.length} Students</span>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between', fontSize:'13px', marginTop:'5px'}}>
                            <span>Remaining:</span>
                            <span style={{fontWeight:'bold', color:'#f87171'}}>{students.length - selectedStudents.length} Students</span>
                        </div>
                    </div>

                    <button 
                        className="promote-btn" 
                        disabled={selectedStudents.length === 0 || isProcessing}
                        onClick={handlePromote}
                    >
                        {isProcessing ? 'Processing...' : 'Run Batch Promotion'}
                    </button>
                    
                    <p style={{fontSize:'11px', color:'#94a3b8', textAlign:'center', marginTop:'15px'}}>
                        Students NOT selected will remain in the current class level for the next session (Fail logic).
                    </p>
                </div>
            </div>
        </div>
    );
}