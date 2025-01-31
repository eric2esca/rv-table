// src/components/DataTable.tsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import styled from 'styled-components';
import { Table, Column, AutoSizer } from 'react-virtualized';
import 'react-virtualized/styles.css'; // Import default styles

// Define a type for our user data (customize based on API response)
interface User {
	name: {
		first: string;
		last: string;
	};
	email: string;
	phone: string;
	// Add more fields as needed...
}

// Styled container for the table
const TableContainer = styled.div`
	width: 100%;
	height: 600px; // Adjust height as needed
	margin: 20px auto;
`;

const DataTable: React.FC = () => {
	const [users, setUsers] = useState<User[]>([]);
	const [loading, setLoading] = useState<boolean>(false);

	// Fetch data from Random User API
	const fetchData = async (results = 50) => {
		setLoading(true);
		try {
			const response = await axios.get(
				`https://randomuser.me/api/?results=${results}`
			);
			const fetchedUsers = response.data.results;
			setUsers(fetchedUsers);
		} catch (error) {
			console.error('Error fetching data:', error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchData(); // Fetch initial data
	}, []);

	// Render a row of data in the table
	const rowRenderer = ({ index, key, style }: any) => {
		const user = users[index];
		return (
			<div
				key={key}
				style={style}
			>
				{user.name.first} {user.name.last} - {user.email}
			</div>
		);
	};

	return (
		<TableContainer>
			{loading && <div>Loading...</div>}
			<AutoSizer>
				{({ height, width }) => (
					<Table
						width={width}
						height={height}
						headerHeight={40}
						rowHeight={40}
						rowCount={users.length}
						rowGetter={({ index }) => users[index]}
					>
						<Column
							label='Name'
							dataKey='name'
							width={200}
							cellRenderer={({ cellData, rowData }) =>
								`${rowData.name.first} ${rowData.name.last}`
							}
						/>
						<Column
							label='Email'
							dataKey='email'
							width={300}
						/>
						<Column
							label='Phone'
							dataKey='phone'
							width={200}
						/>
					</Table>
				)}
			</AutoSizer>
		</TableContainer>
	);
};

export default DataTable;
