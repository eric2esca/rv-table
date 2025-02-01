// src/components/DataTable.tsx
import React, { useEffect, useState, useMemo, useRef, UIEvent } from 'react';
import axios from 'axios';
import styled from 'styled-components';
import {
	Table,
	Column,
	AutoSizer,
	TableHeaderProps,
	Index,
} from 'react-virtualized';
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
	border: 1px solid #ddd;
`;

const ControlsContainer = styled.div`
	margin: 20px;
`;

//
// Main DataTable Component
//
const DataTable: React.FC = () => {
	// ----- Data and Paging States -----
	const [users, setUsers] = useState<User[]>([]);
	const [minPage, setMinPage] = useState<number>(1);
	const [maxPage, setMaxPage] = useState<number>(1);
	const [loading, setLoading] = useState<boolean>(false);
	const pageSize = 50;
	const rowHeight = 40;

	// ----- Sorting State -----
	const [sortBy, setSortBy] = useState<string>('');
	const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('ASC');

	// ----- Column Configuration State -----
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

	// ----- Filtering State -----
	const [filters, setFilters] = useState<{ [key: string]: string }>({});

	// ----- Controlled Scroll Position -----
	const [scrollTop, setScrollTop] = useState<number>(0);
	const tableRef = useRef<Table>(null);

	// ----- Helper: Sort the list of users -----
	const sortList = (
		list: User[],
		sortBy: string,
		sortDirection: 'ASC' | 'DESC'
	): User[] => {
		return [...list].sort((a, b) => {
			let aValue: string, bValue: string;
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

	// ----- Initial Data Fetch -----
	useEffect(() => {
		const fetchData = async (page: number) => {
			setLoading(true);
			try {
				const response = await axios.get(
					`https://randomuser.me/api/?results=${pageSize}&page=${page}`
				);
				const fetchedUsers = response.data.results;
				setUsers(fetchedUsers);
				setMinPage(page);
				setMaxPage(page);
			} catch (error) {
				console.error('Error fetching initial data:', error);
			} finally {
				setLoading(false);
			}
		};
		fetchData(1);
	}, []);

	// ----- Filtering: derive filtered list from users and filters -----
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

	// ----- Upward & Downward Loading Functions -----
	const loadMoreRowsUpward = async () => {
		if (minPage <= 1 || loading) return;
		setLoading(true);
		const newPage = minPage - 1;
		try {
			const response = await axios.get(
				`https://randomuser.me/api/?results=${pageSize}&page=${newPage}`
			);
			const newUsers: User[] = response.data.results;
			setUsers((prev) => [...newUsers, ...prev]);
			setMinPage(newPage);
			setScrollTop((prev) => prev + newUsers.length * rowHeight);
		} catch (error) {
			console.error('Error loading upward rows:', error);
		} finally {
			setLoading(false);
		}
	};

	const loadMoreRowsDownward = async () => {
		if (loading) return;
		setLoading(true);
		const newPage = maxPage + 1;
		try {
			const response = await axios.get(
				`https://randomuser.me/api/?results=${pageSize}&page=${newPage}`
			);
			const newUsers: User[] = response.data.results;
			let combinedUsers = [...users, ...newUsers];
			if (sortBy) {
				combinedUsers = sortList(combinedUsers, sortBy, sortDirection);
			}
			setUsers(combinedUsers);
			setMaxPage(newPage);
		} catch (error) {
			console.error('Error loading downward rows:', error);
		} finally {
			setLoading(false);
		}
	};

	// ----- Custom Scroll Handler for Both Directions -----
	const handleTableScroll = ({
		scrollTop: newScrollTop,
		clientHeight,
		scrollHeight,
	}: {
		scrollTop: number;
		clientHeight: number;
		scrollHeight: number;
	}) => {
		setScrollTop(newScrollTop);
		const threshold = 50;
		if (newScrollTop < threshold && minPage > 1 && !loading) {
			loadMoreRowsUpward();
		}
		if (newScrollTop + clientHeight > scrollHeight - threshold && !loading) {
			loadMoreRowsDownward();
		}
	};

	// ----- Sorting Handler -----
	const handleSort = (params: {
		sortBy: string;
		sortDirection: 'ASC' | 'DESC';
	}) => {
		setSortBy(params.sortBy);
		setSortDirection(params.sortDirection);
		const sortedUsers = sortList(users, params.sortBy, params.sortDirection);
		setUsers(sortedUsers);
	};

	// Toggle sort order for a column (used by the header cells)
	const toggleSort = (dataKey: string) => {
		if (sortBy === dataKey) {
			const newSortDirection = sortDirection === 'ASC' ? 'DESC' : 'ASC';
			handleSort({ sortBy: dataKey, sortDirection: newSortDirection });
		} else {
			handleSort({ sortBy: dataKey, sortDirection: 'ASC' });
		}
	};

	// ----- Drag & Drop Handler for Column Reordering -----
	const handleDragEnd = (result: DropResult) => {
		if (!result.destination) return;
		const newColumns = Array.from(columns);
		const [removed] = newColumns.splice(result.source.index, 1);
		newColumns.splice(result.destination.index, 0, removed);
		setColumns(newColumns);
	};

	// ----- Toggle Column Visibility -----
	const toggleColumnVisibility = (dataKey: string) => {
		setColumns((prev) =>
			prev.map((col) =>
				col.dataKey === dataKey ? { ...col, isVisible: !col.isVisible } : col
			)
		);
	};

	// ----- Filter Change Handler -----
	const handleFilterChange = (dataKey: string, value: string) => {
		setFilters((prev) => ({ ...prev, [dataKey]: value }));
	};

	// ----- Header Cell Component with Drag & Drop and Sorting -----
	interface HeaderCellProps {
		column: ColumnConfig;
		index: number;
	}
	const HeaderCell: React.FC<HeaderCellProps> = ({ column, index }) => {
		return (
			<Draggable
				draggableId={column.dataKey}
				index={index}
			>
				{(provided, snapshot) => (
					<div
						ref={provided.innerRef}
						{...provided.draggableProps}
						style={{
							...provided.draggableProps.style,
							width: column.width,
							padding: '5px 10px',
							borderRight: '1px solid #ddd',
							backgroundColor: snapshot.isDragging ? '#d0d0d0' : '#f7f7f7',
							display: 'flex',
							alignItems: 'center',
						}}
					>
						{/* Drag handle */}
						<div
							{...provided.dragHandleProps}
							style={{ marginRight: '5px', cursor: 'grab', userSelect: 'none' }}
						>
							☰
						</div>
						{/* Column label (clicking toggles sorting) */}
						<div
							style={{ flexGrow: 1, cursor: 'pointer', userSelect: 'none' }}
							onClick={() => toggleSort(column.dataKey)}
						>
							{column.label}
						</div>
						{/* Sorting Button */}
						<button
							onClick={(e) => {
								e.stopPropagation();
								toggleSort(column.dataKey);
							}}
							style={{
								cursor: 'pointer',
								background: 'none',
								border: 'none',
								padding: 0,
								fontSize: 'inherit',
							}}
						>
							{sortBy === column.dataKey
								? sortDirection === 'ASC'
									? '▲'
									: '▼'
								: '↕'}
						</button>
					</div>
				)}
			</Draggable>
		);
	};

	// ----- Header Row Renderer using Drag & Drop -----
	const headerRowRenderer = (headerProps: TableHeaderProps) => {
		const visibleColumns = columns.filter((col) => col.isVisible);
		return (
			<DragDropContext onDragEnd={handleDragEnd}>
				<Droppable
					droppableId='header-droppable'
					direction='horizontal'
				>
					{(provided) => (
						<div
							ref={provided.innerRef}
							{...provided.droppableProps}
							style={{ display: 'flex', ...headerProps.style }}
						>
							{visibleColumns.map((col, index) => (
								<HeaderCell
									key={col.dataKey}
									column={col}
									index={index}
								/>
							))}
							{provided.placeholder}
						</div>
					)}
				</Droppable>
			</DragDropContext>
		);
	};

	// ----- CSV Export Handler -----
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
		const blob = new Blob([csvString], {
			type: 'text/csv;charset=utf-8;',
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.setAttribute('href', url);
		link.setAttribute('download', 'export.csv');
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	// ----- Row Getter for the Table -----
	const rowGetter = ({ index }: Index): User | {} => {
		if (index < filteredUsers.length) {
			return filteredUsers[index];
		}
		return {};
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
				{loading && <div style={{ padding: '10px' }}>Loading...</div>}
				<AutoSizer>
					{({ height, width }) => (
						<Table
							ref={tableRef}
							width={width}
							height={height}
							headerHeight={50}
							rowHeight={rowHeight}
							rowCount={filteredUsers.length}
							rowGetter={rowGetter}
							scrollTop={scrollTop}
							onScroll={({ scrollTop, clientHeight, scrollHeight }) =>
								handleTableScroll({ scrollTop, clientHeight, scrollHeight })
							}
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
			</TableContainer>
		</>
	);
};

export default DataTable;
