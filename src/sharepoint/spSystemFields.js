/**
 * SharePoint System Fields
 *
 * These fields are automatically created by SharePoint and should be ignored
 * during schema drift analysis (as they are not part of our SSOT).
 */
export const SP_SYSTEM_FIELDS = new Set([
  'Id',
  'ID',
  'Title',
  'Created',
  'Author',
  'Modified',
  'Editor',
  'Attachments',
  'GUID',
  'AppAuthor',
  'AppEditor',
  'ContentType',
  'ContentTypeId',
  'FolderChildCount',
  'ItemChildCount',
  'ComplianceAssetId',
  '_ColorTag',
  '_UIVersionString',
  '_HasCopyDestinations',
  '_CopySource',
  'FileSystemObjectType',
  'SortOrder',
  'MetaInfo',
  'ScopeId',
  'UniqueId',
  'InstanceID',
  'Order',
  'PropertyBag',
  'ServerRedirectedEmbedUri',
  'ServerRedirectedEmbedUrl',
  'DocIcon',
  '_ComplianceFlags',
  '_ComplianceTag',
  '_ComplianceTagWrittenTime',
  '_ComplianceTagUserId',
  '_IsRecord',
  '_CommentCount',
  '_LikeCount',
  '_DisplayName',
  'Edit',
  'LinkTitleNoMenu',
  'LinkTitle',
  // ── SP Computed / Derived Fields ────────────────────────────────
  // These are SharePoint-generated computed columns present in every list.
  // They should NEVER be treated as zombie candidates.
  'LinkTitle2',        // Computed: Title with edit menu
  'SelectTitle',       // Computed: Selection checkbox column
  'LinkFilename',      // Computed: Filename with link
  'LinkFilename2',     // Computed: Filename with edit menu
  'LinkFilenameNoMenu',// Computed: Filename without menu
  'Last_x0020_Modified', // Computed: Last Modified (encoded)
  'Created_x0020_Date',  // Computed: Created Date (encoded)
  'FSObjType',         // Computed: File System Object Type
  'PermMask',          // Computed: Effective Permissions Mask
  'PrincipalCount',    // Computed: Principal Count
  'ProgId',            // Computed: Program ID
  'ServerUrl',         // Computed: Server Relative URL
  'EncodedAbsUrl',     // Computed: Encoded Absolute URL
  'BaseName',          // Computed: File Base Name
]);
