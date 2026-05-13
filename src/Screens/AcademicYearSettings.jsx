import React, { useState, useEffect } from 'react';

export default function AcademicYearSettings() {
    const [years, setYears] = useState([]);
    const [newYear, setNewYear] = useState({ name: '', start: '', end: '' });

    // Fetch years from backend
    const fetchYears = async () => {
        const res = await fetch('http://localhost:3001/api/academic-years');
        const data = await res.json();
        setYears(data);
    };

    const handleAdd = async () => {
        await fetch('http://localhost:3001/api/academic-years', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                year_name: newYear.name, 
                start_date: newYear.start, 
                end_date: newYear.end 
            })
        });
        fetchYears(); // Refresh list
    };

    return (
        <div className="p-8 bg-white rounded-xl shadow-md">
            <h2 className="text-2xl font-bold mb-6">Academic Year Management</h2>
            
            {/* Form to add new year */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <input 
                    type="text" placeholder="Year Name (e.g. 2024-25)" 
                    className="border p-2 rounded"
                    onChange={(e) => setNewYear({...newYear, name: e.target.value})}
                />
                <input 
                    type="date" className="border p-2 rounded"
                    onChange={(e) => setNewYear({...newYear, start: e.target.value})}
                />
                <input 
                    type="date" className="border p-2 rounded"
                    onChange={(e) => setNewYear({...newYear, end: e.target.value})}
                />
                <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2 rounded">
                    Add Academic Year
                </button>
            </div>

            {/* List of years */}
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="p-2 border">Year</th>
                        <th className="p-2 border">Duration</th>
                        <th className="p-2 border">Status</th>
                        <th className="p-2 border">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {years.map(y => (
                        <tr key={y.id} className="text-center">
                            <td className="p-2 border">{y.year_name}</td>
                            <td className="p-2 border">{y.start_date} to {y.end_date}</td>
                            <td className="p-2 border">
                                {y.is_current ? 
                                    <span className="text-green-600 font-bold">CURRENT</span> : 
                                    <span className="text-gray-400">Inactive</span>
                                }
                            </td>
                            <td className="p-2 border">
                                {!y.is_current && <button className="text-blue-500 underline">Set as Current</button>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}