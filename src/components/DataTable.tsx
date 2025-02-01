import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import styled from 'styled-components';
import { InfiniteLoader, Table, Column, AutoSizer } from 'react-virtualized';
import {
	DragDropContext,
	Droppable,
	Draggable,
	DropResult,
} from 'react-beautiful-dnd';
import 'react-virtualized/styles.css';

//
// Type Definitions
//
interface User {
	name: {
		first: string;
		last: string;
	};
	email: string;
	phone: string;
}

interface ColumnConfig {
	label: string;
	dataKey: string;
	width: number;
	isVisible: boolean;
	cellRenderer?: (props: any) => JSX.Element | string;
}

//
// Styled Components
//
const TableContainer = styled.div`
	width: 100%;
	height: 600px;
	margin: 20px auto;
`;

const ControlsContainer = styled.div`
	margin: 20px;
`;

//
// Main DataTable Component
//
const DataTable: React.FC = () => {
	// Data state and paging
	const [users, setUsers] = useState<User[]>([]);
	const [loading, setLoading] = useState<boolean>(false);
	const [page, setPage] = useState<number>(1);

	// Sorting state
	const [sortBy, setSortBy] = useState<string>('');
	const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('ASC');

	// Column configuration state
	const [columns, setColumns] = useState<ColumnConfig[]>([
		{
			label: 'Name',
			dataKey: 'name',
			width: 200,
			isVisible: true,
			cellRenderer: ({ rowData }: any) =>
				rowData && rowData.name
					? `${rowData.name.first} ${rowData.name.last}`
					: 'Loading...',
		},
		{
			label: 'Email',
			dataKey: 'email',
			width: 300,
			isVisible: true,
			cellRenderer: ({ rowData }: any) =>
				rowData && rowData.email ? rowData.email : 'Loading...',
		},
		{
			label: 'Phone',
			dataKey: 'phone',
			width: 200,
			isVisible: true,
			cellRenderer: ({ rowData }: any) =>
				rowData && rowData.phone ? rowData.phone : 'Loading...',
		},
	]);

	// Filtering state (keyed by column dataKey)
	const [filters, setFilters] = useState<{ [key: string]: string }>({});

	//
	// Helper: Sort a list of users given a column and direction.
	//
	const sortList = (
		list: User[],
		sortBy: string,
		sortDirection: 'ASC' | 'DESC'
	): User[] => {
		return [...list].sort((a, b) => {
			let aValue, bValue;
			if (sortBy === 'name') {
				aValue = a.name.first;
				bValue = b.name.first;
			} else if (sortBy === 'email' || sortBy === 'phone') {
				aValue = a[sortBy];
				bValue = b[sortBy];
			} else {
				return 0;
			}
			if (aValue < bValue) return sortDirection === 'ASC' ? -1 : 1;
			if (aValue > bValue) return sortDirection === 'ASC' ? 1 : -1;
			return 0;
		});
	};

	//
	// Initial data fetch on mount.
	//
	useEffect(() => {
		const fetchData = async (page: number) => {
			setLoading(true);
			try {
				const response = await axios.get(
					`https://randomuser.me/api/?results=50&page=${page}`
				);
				const fetchedUsers = response.data.results;
				setUsers(fetchedUsers);
			} catch (error) {
				console.error('Error fetching data:', error);
			} finally {
				setLoading(false);
			}
		};
		fetchData(page);
	}, []);

	//
	// Filtering: derive a filtered list from our users and the active filters.
	//
	const filteredUsers = useMemo(() => {
		return users.filter((user) => {
			return Object.entries(filters).every(([key, filterValue]) => {
				if (!filterValue) return true;
				if (key === 'name') {
					const fullName = `${user.name.first} ${user.name.last}`.toLowerCase();
					return fullName.includes(filterValue.toLowerCase());
				}
				return user[key].toLowerCase().includes(filterValue.toLowerCase());
			});
		});
	}, [users, filters]);

	//
	// InfiniteLoader callback: tells InfiniteLoader whether a given row index has been loaded.
	//
	const isRowLoaded = ({ index }: { index: number }) => {
		return index < filteredUsers.length;
	};

	//
	// InfiniteLoader callback: load more rows when needed.
	//
	const loadMoreRows = async ({
		startIndex,
		stopIndex,
	}: {
		startIndex: number;
		stopIndex: number;
	}) => {
		if (loading) return;
		setLoading(true);
		const nextPage = page + 1;
		try {
			const response = await axios.get(
				`https://randomuser.me/api/?results=50&page=${nextPage}`
			);
			const newUsers = response.data.results;
			let combinedUsers = [...users, ...newUsers];
			if (sortBy) {
				combinedUsers = sortList(combinedUsers, sortBy, sortDirection);
			}
			setUsers(combinedUsers);
			setPage(nextPage);
		} catch (error) {
			console.error('Error loading more rows:', error);
		} finally {
			setLoading(false);
		}
	};

	//
	// rowGetter: returns the user data for a given row.
	//
	const rowGetter = ({ index }: { index: number }): User | {} => {
		if (index < filteredUsers.length) {
			return filteredUsers[index];
		}
		return {};
	};

	//
	// Sorting: when the user clicks a header, update sort state and sort the data.
	//
	const handleSort = ({
		sortBy: newSortBy,
		sortDirection: newSortDirection,
	}: {
		sortBy: string;
		sortDirection: 'ASC' | 'DESC';
	}) => {
		setSortBy(newSortBy);
		setSortDirection(newSortDirection);
		const sortedUsers = sortList(users, newSortBy, newSortDirection);
		setUsers(sortedUsers);
	};

	//
	// Drag & Drop: When a drag ends, update the column order.
	//
	const handleDragEnd = (result: DropResult) => {
		if (!result.destination) return;
		const newColumns = Array.from(columns);
		const [removed] = newColumns.splice(result.source.index, 1);
		newColumns.splice(result.destination.index, 0, removed);
		setColumns(newColumns);
	};

	//
	// Toggle whether a column is visible.
	//
	const toggleColumnVisibility = (dataKey: string) => {
		setColumns((prev) =>
			prev.map((col) =>
				col.dataKey === dataKey ? { ...col, isVisible: !col.isVisible } : col
			)
		);
	};

	//
	// Update the filter value for a column.
	//
	const handleFilterChange = (dataKey: string, value: string) => {
		setFilters((prev) => ({ ...prev, [dataKey]: value }));
	};

	//
	// Render a custom header row that uses react-beautiful-dnd
	//
	const headerRowRenderer = (headerProps: any) => {
		const { className, style } = headerProps;
		// Use only the visible columns
		const visibleColumns = columns.filter((col) => col.isVisible);
		return (
			<DragDropContext onDragEnd={handleDragEnd}>
				<Droppable
					droppableId='droppable'
					direction='horizontal'
				>
					{(provided) => (
						<div
							className={className}
							style={{ ...style, display: 'flex' }}
							ref={provided.innerRef}
							{...provided.droppableProps}
						>
							{visibleColumns.map((column, index) => (
								<Draggable
									key={column.dataKey}
									draggableId={column.dataKey}
									index={index}
								>
									{(provided) => (
										<div
											ref={provided.innerRef}
											{...provided.draggableProps}
											{...provided.dragHandleProps}
											style={{
												...provided.draggableProps.style,
												width: column.width,
												padding: '5px 10px',
												borderRight: '1px solid #ddd',
												boxSizing: 'border-box',
												textAlign: 'left',
												backgroundColor: '#f7f7f7',
												cursor: 'move',
											}}
										>
											{column.label}
										</div>
									)}
								</Draggable>
							))}
							{provided.placeholder}
						</div>
					)}
				</Droppable>
			</DragDropContext>
		);
	};

	//
	// Export the current (filtered) view as a CSV.
	//
	const exportToCSV = () => {
		const visibleColumns = columns.filter((col) => col.isVisible);
		const header = visibleColumns.map((col) => col.label).join(',');
		const csvRows = filteredUsers.map((user) => {
			return visibleColumns
				.map((col) => {
					if (col.dataKey === 'name') {
						return `"${user.name.first} ${user.name.last}"`;
					} else {
						return `"${user[col.dataKey]}"`;
					}
				})
				.join(',');
		});
		const csvString = [header, ...csvRows].join('\n');
		const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.setAttribute('href', url);
		link.setAttribute('download', 'export.csv');
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	return (
		<>
			{/* Controls: Column visibility toggles, filters, and CSV export */}
			<ControlsContainer>
				<div>
					<strong>Toggle Column Visibility:</strong>
					{columns.map((col) => (
						<label
							key={col.dataKey}
							style={{ marginLeft: '10px' }}
						>
							<input
								type='checkbox'
								checked={col.isVisible}
								onChange={() => toggleColumnVisibility(col.dataKey)}
							/>
							{col.label}
						</label>
					))}
				</div>
				<div style={{ marginTop: '10px' }}>
					<strong>Filters:</strong>
					{columns
						.filter((col) => col.isVisible)
						.map((col) => (
							<label
								key={col.dataKey}
								style={{ marginLeft: '10px' }}
							>
								{col.label}:
								<input
									type='text'
									value={filters[col.dataKey] || ''}
									onChange={(e) =>
										handleFilterChange(col.dataKey, e.target.value)
									}
								/>
							</label>
						))}
				</div>
				<button
					style={{ marginTop: '10px' }}
					onClick={exportToCSV}
				>
					Export CSV
				</button>
			</ControlsContainer>

			{/* The Table */}
			<TableContainer>
				{loading && <div>Loading...</div>}
				<InfiniteLoader
					isRowLoaded={isRowLoaded}
					loadMoreRows={loadMoreRows}
					rowCount={filteredUsers.length + 1}
				>
					{({ onRowsRendered, registerChild }) => (
						<AutoSizer>
							{({ height, width }) => (
								<Table
									ref={registerChild}
									width={width}
									height={height}
									headerHeight={50}
									rowHeight={40}
									rowCount={filteredUsers.length + 1}
									rowGetter={rowGetter}
									onRowsRendered={onRowsRendered}
									sort={handleSort}
									sortBy={sortBy}
									sortDirection={sortDirection}
									headerRowRenderer={headerRowRenderer}
								>
									{columns
										.filter((col) => col.isVisible)
										.map((col) => (
											<Column
												key={col.dataKey}
												label={col.label}
												dataKey={col.dataKey}
												width={col.width}
												cellRenderer={col.cellRenderer}
											/>
										))}
								</Table>
							)}
						</AutoSizer>
					)}
				</InfiniteLoader>
			</TableContainer>
		</>
	);
};

export default DataTable;
