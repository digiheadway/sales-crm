import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Phone,
  MessageSquare,
  Plus,
  Share2,
  CheckCircle,
  XCircle,
  RotateCcw,
  X,
  ChevronDown,
  ChevronUp,

  Copy,
} from 'lucide-react';
import { useAppContext } from '../../contexts/AppContext';
import { Lead, Todo } from '../../types';
import Badge from '../ui/Badge';
import AddTodoModal from '../todos/AddTodoModal';
import AddActivityModal from '../todos/AddActivityModal';
import TodoViewModal from '../todos/TodoViewModal';
import TodoActionModal from '../todos/TodoActionModal';
import { format } from 'date-fns';
import Dropdown from '../common/Dropdown';
import TagInput from '../common/TagInput';
import { getWhatsAppUrl } from '../../utils/phone';

import { dropdownOptions } from '../../data/options';

const LeadDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const leadId = id ? parseInt(id) : 0;
  const navigate = useNavigate();

  const { getLeadById, getTodosByLeadId, updateLead, setActiveLeadId, fetchSingleLead, isLoading, options, togglePipelineStatus } =
    useAppContext();

  // Get lead from global state, but don't re-render when global state changes
  const lead = getLeadById(leadId);
  const todos = getTodosByLeadId(leadId);

  const [isAddTodoModalOpen, setIsAddTodoModalOpen] = useState(false);
  const [isAddActivityModalOpen, setIsAddActivityModalOpen] = useState(false);
  const [editedLead, setEditedLead] = useState<Lead | null>(null);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [isFetchingLead, setIsFetchingLead] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<
    'complete' | 'cancel' | 'reschedule' | 'reopen'
  >('complete');

  const [collapsedSections, setCollapsedSections] = useState(() => {
    const savedState = localStorage.getItem('collapsedSections');
    return savedState ? JSON.parse(savedState) : {};
  });

  const toggleSection = (section: string) => {
    const newState = {
      ...collapsedSections,
      [section]: !collapsedSections[section],
    };
    setCollapsedSections(newState);
    localStorage.setItem('collapsedSections', JSON.stringify(newState));
  };

  const copyPhoneNumber = async (phoneNumber: string) => {
    try {
      await navigator.clipboard.writeText(phoneNumber);
    } catch (err) {
      // Silent fail - no user feedback needed
    }
  };

  // Fetch lead if not found in current state
  useEffect(() => {
    if (leadId && !lead && !isFetchingLead) {
      setIsFetchingLead(true);
      fetchSingleLead(leadId).finally(() => {
        setIsFetchingLead(false);
      });
    }
  }, [leadId, lead, fetchSingleLead, isFetchingLead]);

  useEffect(() => {
    if (lead) {
      // If we are editing the same lead, check for updates
      if (editedLead && editedLead.id === lead.id) {
        // Sync isInPipeline and timestamp if they differ
        if (
          editedLead.isInPipeline !== lead.isInPipeline ||
          editedLead.updatedAt !== lead.updatedAt
        ) {
          setEditedLead((prev: Lead | null) => ({
            ...prev!,
            isInPipeline: lead.isInPipeline,
            updatedAt: lead.updatedAt,
          }));
        }
      } else {
        // This is for initial load or for a new lead
        setEditedLead(lead);
      }
    }
  }, [lead, editedLead]);

  useEffect(() => {
    if (leadId) {
      setActiveLeadId(leadId);
    }
    return () => {
      setActiveLeadId(null);
    };
  }, [leadId, setActiveLeadId]);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Show loading state while fetching lead data
  if ((isLoading || isFetchingLead) && !lead) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700">
            Loading lead...
          </h2>
        </div>
      </div>
    );
  }

  // Show not found only after loading is complete and lead is still not found
  if (!lead || !editedLead) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">
            Lead not found
          </h2>
          <button
            className="mt-4 btn btn-primary"
            onClick={() => navigate('/leads')}
          >
            Back to Leads
          </button>
        </div>
      </div>
    );
  }

  const handleInputChange = (field: keyof Lead, value: any) => {
    setEditedLead((prev: Lead | null) => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  };

  const handleInputBlur = (field: keyof Lead, value: any) => {
    const updatedValue = value?.trim?.() !== '' ? value : null;
    updateLead(leadId, { [field]: updatedValue });
  };

  const handleImmediateChange = (field: keyof Lead, value: any) => {
    const updatedValue = value?.trim?.() !== '' ? value : null;
    setEditedLead((prev: Lead | null) => {
      if (!prev) return prev;
      return { ...prev, [field]: updatedValue };
    });
    updateLead(leadId, { [field]: updatedValue });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;
    const hasPlus = input.startsWith('+');
    input = input.replace(/\D/g, '').slice(0, 15);
    if (hasPlus) {
      input = '+' + input;
    }
    handleInputChange('phone', input);
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'dd MMM yyyy, h:mm a');
  };

  const handleTodoClick = (todo: Todo) => {
    setSelectedTodo(todo);
    setIsViewModalOpen(true);
  };

  const handleTodoAction = (
    todo: Todo,
    action: 'complete' | 'cancel' | 'reschedule' | 'reopen'
  ) => {
    setSelectedTodo(todo);
    setActionType(action);
    setIsActionModalOpen(true);
  };

  const pendingTodos = todos.filter((todo: Todo) => todo.status === 'Pending');
  const completedTodos = todos.filter((todo: Todo) => todo.status !== 'Pending');

  const renderSectionHeader = (title: string, section: string) => (
    <div
      className="flex items-center justify-between cursor-pointer p-4 py-2"
      onClick={() => toggleSection(section)}
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      {collapsedSections[section] ? (
        <ChevronDown size={20} className="text-gray-500" />
      ) : (
        <ChevronUp size={20} className="text-gray-500" />
      )}
    </div>
  );

  // Show loading state while fetching lead
  if (isLoading || isFetchingLead || !editedLead) {
    return (
      <div className="p-2 md:p-4 pt-6 sm:p-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">
              {isFetchingLead ? 'Fetching lead details...' : 'Loading lead details...'}
            </p>
            {!editedLead && !isFetchingLead && (
              <p className="text-sm text-gray-500 mt-2">Lead not found</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-4 pt-6 sm:p-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="w-full mb-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-xl font-semibold mb-2">
                  #{editedLead.id} {editedLead.name} - {editedLead.budget} Lakh
                </h2>
                <button
                  onClick={() => togglePipelineStatus(editedLead.id, !editedLead.isInPipeline)}
                  className={`text-xs px-2 py-1 rounded-full border ${editedLead.isInPipeline
                    ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200'
                    }`}
                >
                  {editedLead.isInPipeline ? 'In Pipeline' : 'Add to Pipeline'}
                </button>
              </div>

              <button
                onClick={() => window.history.back()}
                className="btn btn-ghost p-2"
                title="Go Back"
              >
                <X size={20} />
              </button>
            </div>
            <div className="text-sm text-gray-600">
              <span>{editedLead.address || 'No address'}</span>
              {editedLead.about && <span> - {editedLead.about}</span>}
              <span> - {formatDateTime(editedLead.updatedAt)}</span>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <a href={`tel:${editedLead.phone}`} className="btn btn-outline">
                <Phone size={18} />
              </a>
              <a
                href={getWhatsAppUrl(editedLead.phone)}
                className="btn btn-success"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageSquare size={18} />
              </a>
              <button
                className="btn btn-outline"
                onClick={() => copyPhoneNumber(editedLead.phone)}
                title="Copy phone number"
              >
                <Copy size={18} />
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setIsAddTodoModalOpen(true)}
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Add Todo</span>
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setIsAddActivityModalOpen(true)}
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Add Activity</span>
              </button>
              <button className="btn btn-outline">
                <Share2 size={18} />
              </button>
            </div>
          </div>

          <div className="block bg-white p-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stage
              </label>
              <Dropdown
                options={dropdownOptions.stage}
                value={editedLead.stage}
                onChange={(value) => handleImmediateChange('stage', value)}
                placeholder="Select stage"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <Dropdown
                options={dropdownOptions.priority}
                value={editedLead.priority}
                onChange={(value) => handleImmediateChange('priority', value)}
                placeholder="Select priority"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Note
              </label>
              <textarea
                className="input resize-none"
                rows={3}
                value={editedLead.note || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleInputChange('note', e.target.value)}
                onBlur={(e: React.FocusEvent<HTMLTextAreaElement>) => handleInputBlur('note', e.target.value)}
                placeholder="Add a note..."
              />
            </div>
          </div>

          {pendingTodos.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              {renderSectionHeader('Pending Tasks', 'pending')}
              {!collapsedSections['pending'] && (
                <div className="p-2 md:p-4 space-y-4 transition-all duration-300">
                  {pendingTodos.map((todo) => (
                    <div
                      key={todo.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => handleTodoClick(todo)}
                      >
                        <h3 className="font-medium">
                          #{todo.id} - {todo.type}
                        </h3>
                        {todo.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {todo.description}
                          </p>
                        )}
                        <p className="text-sm text-gray-500 mt-1">
                          {formatDateTime(todo.dateTime)} {todo.responseNote && <span>({todo.responseNote})</span>}
                        </p>
                      </div>

                      <div className="flex space-x-2 ml-4">
                        <button
                          className="p-1 text-gray-600 hover:text-green-600 rounded-full hover:bg-green-50"
                          onClick={() => handleTodoAction(todo, 'complete')}
                          title="Complete task"
                        >
                          <CheckCircle size={18} />
                        </button>
                        <button
                          className="p-1 text-gray-600 hover:text-red-600 rounded-full hover:bg-red-50"
                          onClick={() => handleTodoAction(todo, 'cancel')}
                          title="Cancel task"
                        >
                          <XCircle size={18} />
                        </button>
                        <button
                          className="p-1 text-gray-600 hover:text-blue-600 rounded-full hover:bg-blue-50"
                          onClick={() => handleTodoAction(todo, 'reschedule')}
                          title="Reschedule task"
                        >
                          <RotateCcw size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-lg shadow">
            {renderSectionHeader('Property Requirements', 'requirements')}
            {!collapsedSections['requirements'] && (
              <div className="p-2 md:p-4 space-y-4 transition-all duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Budget (in Lakhs)
                    </label>
                    <input
                      type="number"
                      value={editedLead.budget}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleInputChange('budget', parseFloat(e.target.value))
                      }
                      onBlur={(e: React.FocusEvent<HTMLInputElement>) =>
                        handleInputBlur('budget', parseFloat(e.target.value))
                      }
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Requirement
                  </label>
                  <textarea
                    value={editedLead.requirement || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      handleInputChange(
                        'requirement',
                        e.target.value
                      )
                    }
                    onBlur={(e: React.FocusEvent<HTMLTextAreaElement>) =>
                      handleInputBlur('requirement', e.target.value)
                    }
                    className="input h-24"
                    placeholder="Enter requirement details"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow">
            {renderSectionHeader('Contact Information', 'contact')}
            {!collapsedSections['contact'] && (
              <div className="p-2 md:p-4 space-y-4 transition-all duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={editedLead.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleInputChange('name', e.target.value)
                      }
                      onBlur={(e: React.FocusEvent<HTMLInputElement>) => handleInputBlur('name', e.target.value)}
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={editedLead.phone}
                      onChange={handlePhoneChange}
                      onBlur={(e: React.FocusEvent<HTMLInputElement>) => handleInputBlur('phone', e.target.value)}
                      className="input"
                      placeholder="Enter phone number (6-15 digits)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editedLead.email || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleInputChange('email', e.target.value)
                      }
                      onBlur={(e: React.FocusEvent<HTMLInputElement>) => handleInputBlur('email', e.target.value)}
                      className="input"
                      placeholder="Enter email address"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Alternate Contact
                    </label>
                    <input
                      type="text"
                      value={editedLead.alternatePhone || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleInputChange('alternatePhone', e.target.value)
                      }
                      onBlur={(e: React.FocusEvent<HTMLInputElement>) =>
                        handleInputBlur('alternatePhone', e.target.value)
                      }
                      className="input"
                      placeholder="Additional contact details"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      value={editedLead.address || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleInputChange('address', e.target.value)
                      }
                      onBlur={(e: React.FocusEvent<HTMLInputElement>) => handleInputBlur('address', e.target.value)}
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      About Person
                    </label>
                    <input
                      type="text"
                      value={editedLead.about || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleInputChange('about', e.target.value)
                      }
                      onBlur={(e: React.FocusEvent<HTMLInputElement>) => handleInputBlur('about', e.target.value)}
                      className="input"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {completedTodos.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              {renderSectionHeader('Task History', 'history')}
              {!collapsedSections['history'] && (
                <div className="p-2 md:p-4 space-y-4 transition-all duration-300">
                  {completedTodos.map((todo) => (
                    <div
                      key={todo.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => handleTodoClick(todo)}
                      >
                        <h3 className="font-medium">
                          #{todo.id} - {todo.type} <Badge label={todo.type} color="blue" />
                        </h3>
                        {todo.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {todo.description}
                          </p>
                        )}
                        <p className="text-sm text-gray-500 mt-1">
                          {formatDateTime(todo.dateTime)}{' '}
                          <Badge
                            label={todo.status}
                            color={
                              todo.status === 'Completed' ? 'green' : 'red'
                            }
                          />
                        </p>
                        {todo.responseNote && (
                          <p className="text-sm text-gray-600 mt-1">
                            <strong>Response:</strong> {todo.responseNote}
                          </p>
                        )}
                      </div>

                      <div className="flex space-x-2 ml-4">
                        <button
                          className="p-1 text-gray-600 hover:text-blue-600 rounded-full hover:bg-blue-50"
                          onClick={() => handleTodoAction(todo, 'reopen')}
                          title="Reopen task"
                        >
                          <RotateCcw size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow">
            {renderSectionHeader('Lead Status', 'status')}
            {!collapsedSections['status'] && (
              <div className="p-2 md:p-4 space-y-4 transition-all duration-300">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lead Score
                  </label>
                  <input
                    type="number"
                    value={editedLead.leadScore}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange('leadScore', parseInt(e.target.value) || 0)
                    }
                    onBlur={(e: React.FocusEvent<HTMLInputElement>) =>
                      handleInputBlur('leadScore', parseInt(e.target.value) || 0)
                    }
                    className="input"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Labels
                  </label>
                  <TagInput
                    options={options.tags}
                    value={editedLead.labels ?? []}
                    onChange={(value) => handleImmediateChange('labels', value)}
                    placeholder="Add labels"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow">
            {renderSectionHeader('Source Information', 'source')}
            {!collapsedSections['source'] && (
              <div className="p-2 md:p-4 space-y-4 transition-all duration-300">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source
                  </label>
                  <Dropdown
                    options={dropdownOptions.source}
                    value={editedLead.source}
                    onChange={(value) => handleImmediateChange('source', value)}
                    placeholder="Select source"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assigned To
                  </label>
                  <input
                    type="text"
                    value={editedLead.assignedTo || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange('assignedTo', e.target.value)
                    }
                    onBlur={(e: React.FocusEvent<HTMLInputElement>) => handleInputBlur('assignedTo', e.target.value)}
                    className="input"
                    placeholder="Assign to..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    List Name
                  </label>
                  <input
                    type="text"
                    value={editedLead.listName || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange('listName', e.target.value)
                    }
                    onBlur={(e: React.FocusEvent<HTMLInputElement>) => handleInputBlur('listName', e.target.value)}
                    className="input"
                    placeholder="Enter list name"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow">
            {renderSectionHeader('Additional Data', 'additional')}
            {!collapsedSections['additional'] && (
              <div className="p-2 md:p-4 space-y-4 transition-all duration-300">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Custom Fields (JSON)
                  </label>
                  <div className="bg-gray-50 p-2 rounded text-xs font-mono overflow-auto max-h-40">
                    <pre>{JSON.stringify(editedLead.customFields, null, 2)}</pre>
                  </div>
                </div>

                <div className="text-sm text-gray-600">
                  <span>Created: {formatDateTime(editedLead.createdAt)}</span>
                  <span className="mx-2">•</span>
                  <span>Updated: {formatDateTime(editedLead.updatedAt)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AddTodoModal
        isOpen={isAddTodoModalOpen}
        onClose={() => setIsAddTodoModalOpen(false)}
        leadId={leadId}
        defaultType="Follow Up"
      />

      <AddActivityModal
        isOpen={isAddActivityModalOpen}
        onClose={() => setIsAddActivityModalOpen(false)}
        leadId={leadId}
      />

      {selectedTodo && (
        <>
          <TodoViewModal
            isOpen={isViewModalOpen}
            onClose={() => {
              setIsViewModalOpen(false);
              setSelectedTodo(null);
            }}
            todo={selectedTodo}
          />
          <TodoActionModal
            isOpen={isActionModalOpen}
            onClose={() => {
              setIsActionModalOpen(false);
              setSelectedTodo(null);
            }}
            todo={selectedTodo}
            actionType={actionType}
          />
        </>
      )}
    </div>
  );
};

export default LeadDetail;
